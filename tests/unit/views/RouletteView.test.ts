import { describe, it, expect, beforeEach, vi } from 'vitest';
import confetti from 'canvas-confetti';
import { RouletteView } from '../../../src/views/RouletteView';
import type { RouletteHandlers } from '../../../src/views/RouletteView';
import type { Shop } from '../../../src/types/Shop';
import type { WheelSegment } from '../../../src/types/Roulette';

// jsdom には canvas 実装がないため、confetti はスタブして呼び出しのみ検証する
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

/** テスト用のお店を生成する。 */
function makeShop(name: string): Shop {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    iconKey: 'ramen',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** テスト用のホイール区画を生成する。 */
function makeSegments(shops: Shop[]): WheelSegment[] {
  const angle = 360 / shops.length;
  return shops.map((shop, i) => ({
    shop,
    startAngle: i * angle,
    endAngle: i === shops.length - 1 ? 360 : (i + 1) * angle,
    color: '#ff8a65',
  }));
}

describe('RouletteView', () => {
  let root: HTMLElement;
  let view: RouletteView;
  let handlers: RouletteHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    root = document.createElement('div');
    document.body.replaceChildren(root);
    view = new RouletteView(root);
    handlers = { onStart: vi.fn(), onStop: vi.fn(), onReset: vi.fn() };
    view.bindEvents(handlers);
  });

  const startBtn = () => root.querySelector('.start-btn') as HTMLButtonElement;
  const stopBtn = () => root.querySelector('.stop-btn') as HTMLButtonElement;
  const resetBtn = () => root.querySelector('.reset-btn') as HTMLButtonElement;
  const overlay = () => root.querySelector('.winner-overlay') as HTMLElement;
  const message = () => root.querySelector('.roulette-message') as HTMLElement;

  describe('初期状態とボタン活性', () => {
    it('初期状態（対象未設定）では Start / Stop とも押せない', () => {
      expect(startBtn().disabled).toBe(true);
      expect(stopBtn().disabled).toBe(true);
    });

    it('setControlsEnabled(true) で idle の Start が押せるようになる', () => {
      view.setControlsEnabled(true);
      expect(startBtn().disabled).toBe(false);
      expect(stopBtn().disabled).toBe(true);
    });

    it('setControlsEnabled(false) で案内メッセージが表示され Start が押せない', () => {
      view.setControlsEnabled(false);
      expect(startBtn().disabled).toBe(true);
      expect(message().textContent).toBe(
        'ルーレット対象のお店を1つ以上選んでください'
      );
    });

    it('setControlsEnabled(true) で案内メッセージが消える', () => {
      view.setControlsEnabled(false);
      view.setControlsEnabled(true);
      expect(message().textContent).toBe('');
    });
  });

  describe('setPhase（状態に応じたボタン制御）', () => {
    beforeEach(() => view.setControlsEnabled(true));

    it('spinning では Stop のみ押せる', () => {
      view.setPhase('spinning');
      expect(startBtn().disabled).toBe(true);
      expect(stopBtn().disabled).toBe(false);
    });

    it('decelerating では Start / Stop とも押せない', () => {
      view.setPhase('decelerating');
      expect(startBtn().disabled).toBe(true);
      expect(stopBtn().disabled).toBe(true);
    });

    it('finished では Start / Stop とも押せない', () => {
      view.setPhase('finished');
      expect(startBtn().disabled).toBe(true);
      expect(stopBtn().disabled).toBe(true);
    });

    it('idle に戻ると Start が押せる', () => {
      view.setPhase('finished');
      view.setPhase('idle');
      expect(startBtn().disabled).toBe(false);
    });
  });

  describe('操作 → ハンドラ呼び出し', () => {
    it('Start クリックで onStart が呼ばれる', () => {
      view.setControlsEnabled(true);
      startBtn().click();
      expect(handlers.onStart).toHaveBeenCalledTimes(1);
    });

    it('Stop クリック（spinning 中）で onStop が呼ばれる', () => {
      view.setControlsEnabled(true);
      view.setPhase('spinning');
      stopBtn().click();
      expect(handlers.onStop).toHaveBeenCalledTimes(1);
    });

    it('「もう一度」クリックで onReset が呼ばれる', () => {
      view.playWinnerEffect(makeShop('ラーメンA'));
      resetBtn().click();
      expect(handlers.onReset).toHaveBeenCalledTimes(1);
    });

    it('オーバーレイの背景（カードの外側）クリックでも onReset が呼ばれる', () => {
      view.playWinnerEffect(makeShop('ラーメンA'));
      overlay().click(); // target がオーバーレイ自身＝カード外側のクリック
      expect(handlers.onReset).toHaveBeenCalledTimes(1);
    });

    it('当選カード内のクリックでは onReset は呼ばれない', () => {
      view.playWinnerEffect(makeShop('ラーメンA'));
      (root.querySelector('.winner-name') as HTMLElement).click();
      expect(handlers.onReset).not.toHaveBeenCalled();
    });

    it('disabled の Start をクリックしても onStart は呼ばれない', () => {
      view.setControlsEnabled(false);
      startBtn().click();
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it('disabled の Stop（idle 中）をクリックしても onStop は呼ばれない', () => {
      view.setControlsEnabled(true);
      stopBtn().click();
      expect(handlers.onStop).not.toHaveBeenCalled();
    });
  });

  describe('当選演出', () => {
    it('playWinnerEffect でオーバーレイにアイコンと店名が表示される', () => {
      view.playWinnerEffect(makeShop('ラーメン二郎 三田本店'));

      expect(overlay().classList.contains('is-hidden')).toBe(false);
      expect(root.querySelector('.winner-icon')?.textContent).toBe('🍜');
      expect(root.querySelector('.winner-name')?.textContent).toBe(
        'ラーメン二郎 三田本店'
      );
    });

    it('店名は textContent で反映され、HTML として解釈されない（XSS無害化）', () => {
      view.playWinnerEffect(makeShop('<script>alert(1)</script>'));

      const nameEl = root.querySelector('.winner-name') as HTMLElement;
      expect(nameEl.textContent).toBe('<script>alert(1)</script>');
      expect(nameEl.querySelector('script')).toBeNull();
    });

    it('playWinnerEffect で紙吹雪（confetti）が一度呼ばれる', () => {
      view.playWinnerEffect(makeShop('カフェB'));
      expect(confetti).toHaveBeenCalledTimes(1);
    });

    it('playWinnerEffect で点滅・ズームの演出クラスが付与される', () => {
      view.playWinnerEffect(makeShop('カフェB'));
      const card = root.querySelector('.winner-card') as HTMLElement;
      expect(card.classList.contains('is-blinking')).toBe(true);
      expect(card.classList.contains('is-zoomed')).toBe(true);
    });

    it('hideWinner でオーバーレイが閉じ、演出クラスが外れる', () => {
      view.playWinnerEffect(makeShop('カフェB'));
      view.hideWinner();

      const card = root.querySelector('.winner-card') as HTMLElement;
      expect(overlay().classList.contains('is-hidden')).toBe(true);
      expect(card.classList.contains('is-blinking')).toBe(false);
      expect(card.classList.contains('is-zoomed')).toBe(false);
    });
  });

  describe('ホイール描画と回転', () => {
    it('canvas の 2D コンテキストが取得できない環境（jsdom）でも renderWheel は例外を投げない', () => {
      const segments = makeSegments([makeShop('A'), makeShop('B')]);
      expect(() => view.renderWheel(segments)).not.toThrow();
    });

    it('setAngle で canvas の transform に回転角が反映される', () => {
      view.setAngle(123.45);
      const canvas = root.querySelector('.wheel-canvas') as HTMLCanvasElement;
      expect(canvas.style.transform).toBe('rotate(123.45deg)');
    });
  });
});
