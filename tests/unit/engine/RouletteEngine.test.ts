import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RouletteEngine } from '../../../src/engine/RouletteEngine';
import type { Shop } from '../../../src/types/Shop';
import type { IconKey } from '../../../src/types/IconKey';

/** テスト用のお店を生成する。 */
function makeShop(name: string, iconKey: IconKey = 'burger'): Shop {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    iconKey,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** 複数のお店をまとめて生成する。 */
function makeShops(count: number): Shop[] {
  return Array.from({ length: count }, (_, i) => makeShop(`お店${i + 1}`));
}

/**
 * Fisher-Yates シャッフルを「並び替えなし（恒等）」にする Math.random の固定値。
 * j = floor(random * (i + 1)) が常に i になるよう、1 に限りなく近い値を返す。
 */
const RANDOM_IDENTITY = 0.999999;

/**
 * requestAnimationFrame / performance.now を決定論的に制御するフェイク。
 * step(ms) で時間を進め、登録済みコールバックを1フレームぶん実行する。
 */
class FakeFrameClock {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;
  private now = 0;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.callbacks.delete(id);
    });
    vi.stubGlobal('performance', { now: () => this.now });
  }

  /** 時間を ms 進め、現在登録されているコールバックを1フレームぶん実行する。 */
  step(ms: number): void {
    this.now += ms;
    const current = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const cb of current) cb(this.now);
  }

  /** 登録待ちのコールバック数（RAFループが生きているかの確認用）。 */
  get pendingCount(): number {
    return this.callbacks.size;
  }
}

describe('RouletteEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('build', () => {
    it('全てのお店を欠落・重複なく区画に配置する', () => {
      const engine = new RouletteEngine();
      const shops = makeShops(5);

      const segments = engine.build(shops);

      expect(segments).toHaveLength(5);
      const ids = segments.map((s) => s.shop.id).sort();
      expect(ids).toEqual(shops.map((s) => s.id).sort());
    });

    it('360度を店数で等分し、区画が隙間なく連続する', () => {
      const engine = new RouletteEngine();

      const segments = engine.build(makeShops(4));

      expect(segments[0].startAngle).toBe(0);
      for (let i = 0; i < segments.length; i++) {
        expect(segments[i].endAngle - segments[i].startAngle).toBeCloseTo(90);
        if (i > 0) {
          expect(segments[i].startAngle).toBe(segments[i - 1].endAngle);
        }
      }
    });

    it('最終区画の endAngle は厳密に 360 になる（誤差の隙間を作らない）', () => {
      const engine = new RouletteEngine();
      // 360 / 7 は割り切れず浮動小数点誤差が出やすい
      const segments = engine.build(makeShops(7));
      expect(segments[segments.length - 1].endAngle).toBe(360);
    });

    it('N=1 のとき全周（0〜360）の1区画になる', () => {
      const engine = new RouletteEngine();
      const segments = engine.build(makeShops(1));
      expect(segments).toHaveLength(1);
      expect(segments[0].startAngle).toBe(0);
      expect(segments[0].endAngle).toBe(360);
    });

    it('空配列を渡すと空配列を返す', () => {
      const engine = new RouletteEngine();
      expect(engine.build([])).toEqual([]);
    });

    it('隣接区画（円環の先頭と末尾を含む）の色が被らない', () => {
      const engine = new RouletteEngine();
      // パレット循環の境界（N % パレット長 = 1）を含む幅広い件数で確認する
      for (let n = 2; n <= 12; n++) {
        const segments = engine.build(makeShops(n));
        for (let i = 0; i < segments.length; i++) {
          const next = segments[(i + 1) % segments.length];
          expect(segments[i].color).not.toBe(next.color);
        }
      }
    });

    it('ランダム順に配置される（シャッフルが乱数に依存する）', () => {
      // Given: 乱数を固定すると並びが決定論的になる
      vi.spyOn(Math, 'random').mockReturnValue(RANDOM_IDENTITY);
      const engine = new RouletteEngine();
      const shops = makeShops(4);
      // When: 恒等シャッフル（random≒1 で j=i になる）
      const segments = engine.build(shops);
      // Then: 入力順がそのまま維持される＝並びは Math.random で決まっている
      expect(segments.map((s) => s.shop.id)).toEqual(shops.map((s) => s.id));
    });
  });

  describe('getWinner', () => {
    let engine: RouletteEngine;
    let shops: Shop[];

    beforeEach(() => {
      // 恒等シャッフルで並びを固定: お店1=0〜90 / 2=90〜180 / 3=180〜270 / 4=270〜360
      vi.spyOn(Math, 'random').mockReturnValue(RANDOM_IDENTITY);
      engine = new RouletteEngine();
      shops = makeShops(4);
      engine.build(shops);
    });

    it('回転0度のとき針（12時方向）は先頭区画を指す', () => {
      expect(engine.getWinner(0).id).toBe(shops[0].id);
    });

    it('時計回りに90度回転すると最後の区画が針の下に来る', () => {
      // ホイールが90度進む ⇒ 針はホイール座標系で 360-90=270 度を指す
      expect(engine.getWinner(90).id).toBe(shops[3].id);
    });

    it('区画境界では次の区画が当選する（[start, end) の半開区間）', () => {
      // 針位置 90 度ちょうど ⇒ お店2 の区画 [90, 180) に含まれる
      expect(engine.getWinner(270).id).toBe(shops[1].id);
    });

    it('360度を超える角度でも正規化して判定できる', () => {
      // 405度 = 実質45度回転 ⇒ 針位置 315 度 ⇒ お店4
      expect(engine.getWinner(405).id).toBe(shops[3].id);
    });

    it('負の角度でも 0〜360 未満に正規化して判定できる', () => {
      // -90度 ⇒ 針位置 90 度 ⇒ お店2
      expect(engine.getWinner(-90).id).toBe(shops[1].id);
    });

    it('N=1 のときどの角度でも唯一のお店が当選する', () => {
      const single = new RouletteEngine();
      const [only] = makeShops(1);
      single.build([only]);
      for (const angle of [0, 123.4, 360, 720, -45]) {
        expect(single.getWinner(angle).id).toBe(only.id);
      }
    });
  });

  describe('start / stop / reset（状態遷移）', () => {
    let clock: FakeFrameClock;
    let engine: RouletteEngine;

    beforeEach(() => {
      clock = new FakeFrameClock();
      clock.install();
      vi.spyOn(Math, 'random').mockReturnValue(RANDOM_IDENTITY);
      engine = new RouletteEngine();
      engine.build(makeShops(4));
    });

    it('初期状態は idle で、start で spinning になる', () => {
      expect(engine.state).toBe('idle');
      engine.start(() => {});
      expect(engine.state).toBe('spinning');
    });

    it('build 前（区画なし）の start は無視される', () => {
      const empty = new RouletteEngine();
      empty.start(() => {});
      expect(empty.state).toBe('idle');
      expect(clock.pendingCount).toBe(0);
    });

    it('回転中は毎フレーム onUpdate に増加する角度が通知される', () => {
      const angles: number[] = [];
      engine.start((angle) => angles.push(angle));

      clock.step(16);
      clock.step(16);
      clock.step(16);

      expect(angles).toHaveLength(3);
      // 等速 0.36 deg/ms × 16ms = 5.76度ずつ進む
      expect(angles[0]).toBeCloseTo(5.76);
      expect(angles[1]).toBeGreaterThan(angles[0]);
      expect(angles[2]).toBeGreaterThan(angles[1]);
    });

    it('spinning 中の再 start は無視される（多重ループ防止）', () => {
      engine.start(() => {});
      clock.step(16);
      engine.start(() => {});
      // RAFループが1本のままであること
      expect(clock.pendingCount).toBe(1);
    });

    it('stop で decelerating になり、減速完了で finished になって onFinish が一度だけ呼ばれる', () => {
      const onFinish = vi.fn();
      engine.start(() => {});
      clock.step(16);

      engine.stop(() => {}, onFinish);
      expect(engine.state).toBe('decelerating');

      // 減速時間は最大6000ms。十分な回数フレームを進めて着地させる
      for (let i = 0; i < 100; i++) clock.step(100);

      expect(engine.state).toBe('finished');
      expect(onFinish).toHaveBeenCalledTimes(1);
      // 着地後はRAFループが残っていない
      expect(clock.pendingCount).toBe(0);
    });

    it('onFinish には build したお店のいずれかが当選として渡される', () => {
      const shops = makeShops(4);
      engine.build(shops);
      const onFinish = vi.fn();
      engine.start(() => {});
      clock.step(16);
      engine.stop(() => {}, onFinish);
      for (let i = 0; i < 100; i++) clock.step(100);

      const winner = onFinish.mock.calls[0][0] as Shop;
      expect(shops.some((s) => s.id === winner.id)).toBe(true);
    });

    it('減速中も角度は単調増加する（逆回転しない）', () => {
      const angles: number[] = [];
      engine.start(() => {});
      clock.step(16);
      engine.stop((angle) => angles.push(angle), vi.fn());
      for (let i = 0; i < 100; i++) clock.step(100);

      for (let i = 1; i < angles.length; i++) {
        expect(angles[i]).toBeGreaterThanOrEqual(angles[i - 1]);
      }
    });

    it('idle 状態での stop は無視される', () => {
      const onFinish = vi.fn();
      engine.stop(() => {}, onFinish);
      expect(engine.state).toBe('idle');
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('reset で idle に戻り、以降のフレームで onUpdate が呼ばれない', () => {
      const onUpdate = vi.fn();
      engine.start(onUpdate);
      clock.step(16);
      expect(onUpdate).toHaveBeenCalledTimes(1);

      engine.reset();
      expect(engine.state).toBe('idle');
      clock.step(16);
      expect(onUpdate).toHaveBeenCalledTimes(1); // 増えていない
    });

    it('減速中でも reset で中断して idle に戻れる', () => {
      const onFinish = vi.fn();
      engine.start(() => {});
      clock.step(16);
      engine.stop(() => {}, onFinish);
      clock.step(100); // 減速途中

      engine.reset();
      expect(engine.state).toBe('idle');
      for (let i = 0; i < 100; i++) clock.step(100);
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('finished から reset で idle に戻り、再度 start できる', () => {
      engine.start(() => {});
      clock.step(16);
      engine.stop(() => {}, vi.fn());
      for (let i = 0; i < 100; i++) clock.step(100);
      expect(engine.state).toBe('finished');

      engine.reset();
      expect(engine.state).toBe('idle');
      engine.start(() => {});
      expect(engine.state).toBe('spinning');
    });
  });
});
