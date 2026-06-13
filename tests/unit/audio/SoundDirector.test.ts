import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SoundDirector,
  segmentIndexAt,
} from '../../../src/audio/SoundDirector';

// --- AudioContext のスタブ（jsdom に Web Audio がないため再生経路の検証に使う） ---

class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeAudioNode {
  // 実装は osc.connect(gain).connect(master) とチェーンするため引数を返す
  connect = vi.fn((node: unknown) => node);
  disconnect = vi.fn();
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  /** 生成されたインスタンス（遅延初期化の検証に使う）。テストごとにリセットする。 */
  static instances: FakeAudioContext[] = [];
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeAudioNode();
  oscillators: FakeOscillatorNode[] = [];
  resume = vi.fn();

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createOscillator(): FakeOscillatorNode {
    const osc = new FakeOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }
}

describe('segmentIndexAt', () => {
  it('区画の先頭角度では同じ区画のインデックスを返す（12区画・1区画30度）', () => {
    // Given: 12区画（1区画30度） / When-Then: 境界の手前と直後で区画が変わる
    expect(segmentIndexAt(0, 12)).toBe(0);
    expect(segmentIndexAt(29.9, 12)).toBe(0);
    expect(segmentIndexAt(30, 12)).toBe(1);
  });

  it('360 を超える角度（減速中の通算角度）でもインデックスが進み続ける', () => {
    expect(segmentIndexAt(360, 12)).toBe(12);
    expect(segmentIndexAt(720.5, 12)).toBe(24);
  });

  it('区画が1件でも1周ごとにインデックスが進む（周回の継ぎ目を検知できる）', () => {
    expect(segmentIndexAt(359.9, 1)).toBe(0);
    expect(segmentIndexAt(360, 1)).toBe(1);
    expect(segmentIndexAt(720, 1)).toBe(2);
  });
});

describe('SoundDirector', () => {
  it('初期状態では音が無効（ミュート）になっている', () => {
    const director = new SoundDirector();
    expect(director.enabled).toBe(false);
  });

  it('toggle() で有効/無効が反転し、切り替え後の状態を返す', () => {
    const director = new SoundDirector();
    expect(director.toggle()).toBe(true);
    expect(director.enabled).toBe(true);
    expect(director.toggle()).toBe(false);
    expect(director.enabled).toBe(false);
  });

  it('AudioContext がない環境（jsdom）でも各メソッドが例外を投げない', () => {
    // Given: jsdom には AudioContext が存在しない前提を確認する
    expect(typeof AudioContext).toBe('undefined');

    const director = new SoundDirector();
    director.toggle(); // 音ONにして発音経路まで通す
    expect(() => {
      director.setSegmentCount(12);
      director.handlePhase('spinning');
      director.handleAngle(0);
      director.handleAngle(45); // 境界通過 → カチカチ発音経路
      director.handlePhase('decelerating');
      director.handleAngle(400);
      director.handlePhase('finished'); // ファンファーレ経路
      director.handlePhase('idle');
    }).not.toThrow();
  });

  it('音OFFのまま全状態を遷移しても例外を投げない（AudioContext を要求しない）', () => {
    const director = new SoundDirector();
    expect(() => {
      director.setSegmentCount(8);
      director.handlePhase('spinning');
      director.handleAngle(100);
      director.handlePhase('decelerating');
      director.handlePhase('finished');
      director.handlePhase('idle');
    }).not.toThrow();
    expect(director.enabled).toBe(false);
  });

  it('減速中に toggle で ON にしても例外を投げない', () => {
    const director = new SoundDirector();
    director.setSegmentCount(8);
    director.handlePhase('spinning');
    director.handlePhase('decelerating');
    expect(() => director.toggle()).not.toThrow();
    expect(director.enabled).toBe(true);
  });

  it('区画数 0（対象店なし）で handleAngle を呼んでも例外を投げない', () => {
    const director = new SoundDirector();
    director.setSegmentCount(0);
    expect(() => director.handleAngle(123)).not.toThrow();
  });
});

describe('SoundDirector（AudioContext スタブによる再生経路）', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** 直近に生成された AudioContext スタブを返す。 */
  const ctx = () => FakeAudioContext.instances.at(-1) as FakeAudioContext;

  it('ONへの切り替えで AudioContext を生成する（遅延初期化）', () => {
    const director = new SoundDirector();
    expect(FakeAudioContext.instances).toHaveLength(0);
    director.toggle();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('OFFのまま状態遷移しても AudioContext を生成しない（初期OFF要件）', () => {
    const director = new SoundDirector();
    director.setSegmentCount(4);
    director.handlePhase('spinning');
    director.handleAngle(100);
    director.handlePhase('decelerating');
    director.handlePhase('finished');
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('減速（decelerating）では新たな音源を生成しない（カチカチのみが継続する）', () => {
    const director = new SoundDirector();
    director.toggle();
    director.handlePhase('decelerating');
    expect(ctx().oscillators).toHaveLength(0);
  });

  it('確定（finished）でファンファーレの音符がスケジュールされる', () => {
    const director = new SoundDirector();
    director.toggle();
    director.handlePhase('finished');

    // アルペジオ4音 + 締めの和音3音 = 7つのオシレーター
    expect(ctx().oscillators).toHaveLength(7);
    for (const osc of ctx().oscillators) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('区画境界の通過でカチカチ音が鳴り、30ms未満の連続通過は間引かれる', () => {
    // Given: 4区画（1区画90度）・発音時刻を制御する
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(1000) // 1回目の通過 → 発音
      .mockReturnValueOnce(1010) // 2回目: 10ms後 → 間引き
      .mockReturnValueOnce(1200); // 3回目: 200ms後 → 発音
    const director = new SoundDirector();
    director.toggle();
    director.setSegmentCount(4);
    director.handlePhase('spinning');

    // When: 境界（90度の倍数）を3回跨ぐ
    director.handleAngle(0);
    director.handleAngle(91);
    director.handleAngle(181);
    director.handleAngle(271);

    // Then: 2回目はスロットルで間引かれ、カチカチ音は2回
    expect(ctx().oscillators).toHaveLength(2);
  });

  it('当選確定後（finished）の角度リセットではカチカチ音が鳴らない（「もう一度」対応）', () => {
    // Given: 減速の終端で大きな通算角度を記憶している状態
    const director = new SoundDirector();
    director.toggle();
    director.setSegmentCount(4);
    director.handlePhase('spinning');
    director.handleAngle(2000);
    director.handlePhase('finished'); // ここでファンファーレのオシレーターが生成される

    // When: 「もう一度」で角度が 0 に巻き戻される（区画インデックスが大きく変わる）
    const oscillatorsBeforeReset = ctx().oscillators.length;
    director.handleAngle(0);

    // Then: ホイールは動いていないのでカチカチ音は追加されない
    expect(ctx().oscillators).toHaveLength(oscillatorsBeforeReset);
  });

  it('idle 中の角度更新でもカチカチ音は鳴らない', () => {
    const director = new SoundDirector();
    director.toggle();
    director.setSegmentCount(4);
    director.handleAngle(0);
    director.handleAngle(91); // 境界相当の変化だが idle のため発音しない
    expect(ctx().oscillators).toHaveLength(0);
  });

  it('減速中（decelerating）の境界通過ではカチカチ音が鳴り続ける', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1200);
    const director = new SoundDirector();
    director.toggle();
    director.setSegmentCount(4);
    director.handlePhase('spinning');
    director.handleAngle(0);
    director.handleAngle(91); // spinning 中の通過 → 1回目
    director.handlePhase('decelerating');
    director.handleAngle(181); // 減速中の通過 → 2回目
    expect(ctx().oscillators).toHaveLength(2);
  });

  it('ONへの切り替えで iOS の audio session を playback に設定する（マナーモード対策）', () => {
    // Given: navigator.audioSession（WebKit独自・iOS 17+）が存在する環境
    const audioSession = { type: 'ambient' };
    Object.defineProperty(navigator, 'audioSession', {
      value: audioSession,
      configurable: true,
    });

    try {
      // When: 効果音をONにする
      new SoundDirector().toggle();

      // Then: メディアチャンネル扱いになり、マナーモード・着信音量の影響を受けない
      expect(audioSession.type).toBe('playback');
    } finally {
      delete (navigator as Navigator & { audioSession?: unknown })
        .audioSession;
    }
  });

  it('navigator.audioSession が無い環境では ON 切替しても例外を投げない', () => {
    // jsdom には audioSession が存在しない（非対応環境では no-op の確認）
    expect('audioSession' in navigator).toBe(false);
    const director = new SoundDirector();
    expect(() => director.toggle()).not.toThrow();
    expect(director.enabled).toBe(true);
  });

  it('同じ区画内の角度更新ではカチカチ音は鳴らない', () => {
    const director = new SoundDirector();
    director.toggle();
    director.setSegmentCount(4);
    director.handlePhase('spinning');

    director.handleAngle(0);
    director.handleAngle(10);
    director.handleAngle(89.9);
    expect(ctx().oscillators).toHaveLength(0);
  });
});
