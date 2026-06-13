import type { RouletteSounds, RouletteState } from '../types/Roulette';

/**
 * カチカチ音の最低間隔（ミリ秒）。区画数が多いと毎秒100回近く境界を通過しうるため、
 * 発音をこの間隔で間引いて音のスケジューリング負荷から 60fps を守る。
 */
const MIN_TICK_INTERVAL_MS = 30;
/** マスター音量（0〜1）。全効果音をこのゲイン経由で出し、爆音・音割れを防ぐ。 */
const MASTER_VOLUME = 0.3;
/** ファンファーレのアルペジオ（ド・ミ・ソ・高いド）。最後は同和音を伸ばす。 */
const FANFARE_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5];
/** ファンファーレの音符の間隔（秒）。 */
const FANFARE_NOTE_GAP_SEC = 0.12;

/**
 * WebKit 独自の Audio Session API（iOS 17+）。lib.dom.d.ts に型が無いため
 * グローバル型を汚染しないローカル型でナローイングする。
 */
interface AudioSessionLike {
  type: string;
}

/**
 * iOS（WebKit）の audio session を 'playback' に切り替える。
 *
 * iOS では Web Audio API がデフォルトで着信音チャンネル（type: 'ambient'）で
 * 再生されるため、マナーモード中は無音になり、音量も着信音量に従ってしまう
 * （WebKit Bug 237322）。'playback' にするとメディアチャンネル扱いになり、
 * マナーモードの影響を受けず通常の音量ボタンで調整できる。
 * 非対応環境（PC各ブラウザ・iOS 16以前・jsdom）では何もしない。
 */
function applyPlaybackAudioSession(): void {
  const audioSession = (
    navigator as Navigator & { audioSession?: AudioSessionLike }
  ).audioSession;
  if (audioSession) audioSession.type = 'playback';
}

/**
 * 回転角度が指すホイール区画のインデックスを返す（カチカチ音の境界通過判定用）。
 *
 * 減速中の角度は 360 を超えて増え続けるため正規化せずに floor する。
 * これにより1周ごとにもインデックスが進み、区画1件でも周回の継ぎ目で
 * 「境界通過」を検知できる。
 *
 * @param angleDeg ホイールの回転角度（度。360超も可）
 * @param segmentCount 区画数（1以上）
 * @returns 通算の区画インデックス（角度が増えるほど大きくなる）
 */
export function segmentIndexAt(angleDeg: number, segmentCount: number): number {
  return Math.floor(angleDeg / (360 / segmentCount));
}

/**
 * ルーレット効果音の Web Audio API 実装。
 *
 * 音声ファイルを使わず、カチカチ音（矩形波クリック）と
 * ファンファーレ（三角波アルペジオ）を合成する。
 *
 * 効果音は「演出」のため、失敗してもアプリ本体を止めない方針:
 * AudioContext が使えない環境（jsdom 等）や生成失敗時は全メソッドが no-op になる。
 * AudioContext は音が初めて必要になった時（= ユーザー操作起点）に遅延生成し、
 * Chrome / iOS の自動再生制限を回避する。初期状態はミュート（enabled = false）。
 */
export class SoundDirector implements RouletteSounds {
  private isEnabled = false;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private segmentCount = 0;
  /** 前回の角度。減速→等速の周回ラップ（角度の減少）検知に使う。 */
  private prevAngle: number | null = null;
  /** 前回の区画インデックス。変化したら境界通過とみなす。 */
  private prevIndex: number | null = null;
  private lastTickAt = 0;
  /**
   * 直近のルーレット状態。カチカチ音を回転中（spinning / decelerating）に限定するために
   * 保持する。「もう一度」では finished のまま角度が 0 へ戻されるため、ゲートがないと
   * インデックスの巻き戻りを境界通過と誤検知してカチッと鳴ってしまう。
   */
  private currentPhase: RouletteState = 'idle';

  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 音のON/OFFを切り替える。ONへの切り替えはユーザー操作（クリック）起点のため、
   * このタイミングでの AudioContext 生成は自動再生制限に抵触しない。
   *
   * @returns 切り替え後の有効状態
   */
  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) this.ensureContext();
    return this.isEnabled;
  }

  /**
   * ホイールの区画数を設定し、境界通過のトラッキングをリセットする。
   *
   * @param count 区画数（renderWheel した segments の件数）
   */
  setSegmentCount(count: number): void {
    this.segmentCount = count;
    this.prevAngle = null;
    this.prevIndex = null;
  }

  /**
   * 毎フレームの回転角度から区画境界の通過を検知し、カチカチ音を鳴らす。
   * ミュート中もトラッキングだけは継続する（途中でONにしても自然に鳴り始める）。
   *
   * @param angleDeg ホイールの回転角度（度。減速中は360を超えて増え続ける）
   */
  handleAngle(angleDeg: number): void {
    if (this.segmentCount <= 0) return;

    const index = segmentIndexAt(angleDeg, this.segmentCount);
    // 等速回転中は角度が %360 でラップして急に小さくなる。このときインデックスも
    // 巻き戻るため「減少 = 周回の継ぎ目を通過した」として境界通過に含める
    const wrapped = this.prevAngle !== null && angleDeg < this.prevAngle;
    const crossed =
      this.prevIndex !== null && (index !== this.prevIndex || wrapped);
    this.prevAngle = angleDeg;
    this.prevIndex = index;

    // ホイールが動いている間だけ鳴らす（リセット時の角度0への巻き戻りでは鳴らさない）
    const isWheelMoving =
      this.currentPhase === 'spinning' || this.currentPhase === 'decelerating';
    if (!crossed || !this.isEnabled || !isWheelMoving) return;
    const now = performance.now();
    if (now - this.lastTickAt < MIN_TICK_INTERVAL_MS) return;
    this.lastTickAt = now;
    this.playTick();
  }

  /**
   * ルーレットの状態遷移に応じて音を切り替える。
   *
   * @param state 遷移後のルーレット状態
   */
  handlePhase(state: RouletteState): void {
    this.currentPhase = state;
    switch (state) {
      case 'spinning':
        // Start のたびにホイールが再構築されるため、前回の角度記憶を捨てる
        this.prevAngle = null;
        this.prevIndex = null;
        break;
      case 'finished':
        if (this.isEnabled) this.playFanfare();
        break;
      // decelerating / idle はカチカチ（handleAngle）以外の音を持たないため何もしない
    }
  }

  /**
   * AudioContext を遅延生成して返す。利用不可・生成失敗時は null（以降 no-op）。
   * ブラウザが suspended で開始した場合はユーザー操作起点の呼び出しで resume する。
   */
  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      // ユーザー操作起点の呼び出しで一時停止状態から復帰させる
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    if (typeof AudioContext === 'undefined') return null;
    try {
      applyPlaybackAudioSession();
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = MASTER_VOLUME;
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch (error) {
      // 効果音は演出のため、失敗してもアプリ本体を止めず無音で継続する
      console.warn('効果音を初期化できませんでした', error);
      this.ctx = null;
      this.masterGain = null;
      return null;
    }
  }

  /** カチカチ音を1回鳴らす（高めの矩形波を約30msで急減衰させたクリック）。 */
  private playTick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1000;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.5, now);
    // exponentialRamp は 0 を指定できないため十分小さい値まで減衰させる
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /** ファンファーレを再生する（三角波のアルペジオ + 最後に和音を伸ばす）。 */
  private playFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const start = ctx.currentTime;
    FANFARE_NOTES_HZ.forEach((freq, i) => {
      this.playFanfareNote(ctx, freq, start + i * FANFARE_NOTE_GAP_SEC, 0.2);
    });
    // 締めの和音（ド・ミ・ソ）をアルペジオの後に重ねて余韻を作る
    const chordStart = start + FANFARE_NOTES_HZ.length * FANFARE_NOTE_GAP_SEC;
    for (const freq of FANFARE_NOTES_HZ.slice(0, 3)) {
      this.playFanfareNote(ctx, freq, chordStart, 0.8);
    }
  }

  /** ファンファーレの単音を指定時刻にスケジュールする。 */
  private playFanfareNote(
    ctx: AudioContext,
    freqHz: number,
    startTime: number,
    durationSec: number
  ): void {
    if (!this.masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freqHz;
    gain.gain.setValueAtTime(0.6, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);
    osc.connect(gain).connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + durationSec);
  }
}
