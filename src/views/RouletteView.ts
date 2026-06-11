import confetti from 'canvas-confetti';
import type { Shop } from '../types/Shop';
import type { WheelSegment, RouletteState } from '../types/Roulette';
import { getIconDef } from '../icons/iconDefs';

/**
 * RouletteView が外部（main.ts）へ通知する操作ハンドラ。
 * Start / Stop / もう一度（リセット）の3操作を上位（RouletteEngine の制御）へ委ねる。
 */
export interface RouletteHandlers {
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

/** canvas の論理解像度（px）。表示サイズは CSS で可変にする。 */
const CANVAS_SIZE = 400;
/** ホイール半径（px）。外周に枠線ぶんの余白を残す。 */
const WHEEL_RADIUS = CANVAS_SIZE / 2 - 8;
/** 区画ラベル（絵文字＋店名）を配置する半径の比率。 */
const LABEL_RADIUS_RATIO = 0.62;
/** 区画ラベルの店名の最大表示文字数。超えた分は省略記号にする。 */
const MAX_LABEL_CHARS = 6;
/** 対象0件のときの案内メッセージ。 */
const EMPTY_MESSAGE = 'ルーレット対象のお店を1つ以上選んでください';

/**
 * 円形ホイールのルーレットを描画・操作する UI レイヤー。
 *
 * 責務は canvas への扇形描画、CSS transform による回転反映、ボタン活性制御、
 * 当選演出（点滅・ズーム・紙吹雪）のみ。回転計算・当選判定は RouletteEngine が担い、
 * 本クラスは handlers 経由で上位（main.ts）に操作を委ねる。
 *
 * 扇形は canvas に一度だけ描画し、回転は canvas 要素への CSS transform で行う
 * （毎フレーム再描画せず GPU 合成で軽量に回す）。
 */
export class RouletteView {
  private readonly canvas: HTMLCanvasElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly stopBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly messageEl: HTMLParagraphElement;
  private readonly overlayEl: HTMLDivElement;
  private readonly winnerCardEl: HTMLDivElement;
  private readonly winnerIconEl: HTMLSpanElement;
  private readonly winnerNameEl: HTMLSpanElement;

  /** 現在のルーレット状態。ボタン活性の計算に使う。 */
  private phase: RouletteState = 'idle';
  /** 対象店が1件以上あり Start 可能か。ボタン活性の計算に使う。 */
  private canStart = false;

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = '';

    const section = document.createElement('section');
    section.className = 'roulette';

    // ホイール（針 + canvas）
    const wheelArea = document.createElement('div');
    wheelArea.className = 'wheel-area';

    const pointer = document.createElement('div');
    pointer.className = 'wheel-pointer';
    pointer.textContent = '▼';
    pointer.setAttribute('aria-hidden', 'true');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wheel-canvas';
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;

    wheelArea.append(pointer, this.canvas);

    // 対象0件の案内メッセージ
    this.messageEl = document.createElement('p');
    this.messageEl.className = 'roulette-message';
    this.messageEl.setAttribute('role', 'status');

    // Start / Stop ボタン
    const controls = document.createElement('div');
    controls.className = 'roulette-controls';

    this.startBtn = document.createElement('button');
    this.startBtn.type = 'button';
    this.startBtn.className = 'start-btn';
    this.startBtn.textContent = 'Start';

    this.stopBtn = document.createElement('button');
    this.stopBtn.type = 'button';
    this.stopBtn.className = 'stop-btn';
    this.stopBtn.textContent = 'Stop';

    controls.append(this.startBtn, this.stopBtn);

    // 当選オーバーレイ（点滅・ズーム・アイコン+店名・もう一度）
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'winner-overlay is-hidden';

    this.winnerCardEl = document.createElement('div');
    this.winnerCardEl.className = 'winner-card';

    const winnerHeading = document.createElement('p');
    winnerHeading.className = 'winner-heading';
    winnerHeading.textContent = '🎉 今日のごはんはここ！';

    this.winnerIconEl = document.createElement('span');
    this.winnerIconEl.className = 'winner-icon';

    this.winnerNameEl = document.createElement('span');
    this.winnerNameEl.className = 'winner-name';

    this.resetBtn = document.createElement('button');
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'reset-btn';
    this.resetBtn.textContent = 'もう一度';

    this.winnerCardEl.append(
      winnerHeading,
      this.winnerIconEl,
      this.winnerNameEl,
      this.resetBtn
    );
    this.overlayEl.appendChild(this.winnerCardEl);

    section.append(wheelArea, this.messageEl, controls, this.overlayEl);
    this.root.appendChild(section);

    this.updateControls();
  }

  /**
   * 操作ハンドラを結びつける。
   *
   * @param handlers Start / Stop / もう一度 を受け取るコールバック群
   */
  bindEvents(handlers: RouletteHandlers): void {
    this.startBtn.addEventListener('click', () => handlers.onStart());
    this.stopBtn.addEventListener('click', () => handlers.onStop());
    this.resetBtn.addEventListener('click', () => handlers.onReset());
    // 背景（カードの外側）クリックでも「もう一度」と同じリセット操作にする。
    // カード内のクリックは target が子要素になるため発火しない
    this.overlayEl.addEventListener('click', (event) => {
      if (event.target === this.overlayEl) handlers.onReset();
    });
  }

  /**
   * ホイール区画を canvas に描画する（扇形＋絵文字＋店名）。
   *
   * jsdom などで 2D コンテキストが取得できない環境では描画をスキップする
   * （操作・状態の振る舞いはテスト可能なまま、描画のみ無効化）。
   *
   * @param segments RouletteEngine.build が構築した区画
   */
  renderWheel(segments: WheelSegment[]): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const center = CANVAS_SIZE / 2;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (const segment of segments) {
      // 区画の角度は「12時方向=0度・時計回り」。canvas の arc は「3時方向=0ラジアン」
      // のため -90 度ずらして変換する
      const startRad = toRad(segment.startAngle - 90);
      const endRad = toRad(segment.endAngle - 90);

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, WHEEL_RADIUS, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      this.drawLabel(ctx, segment, center);
    }

    // 外周の縁取りで「運命の輪」らしさを出す（主張しすぎないグレーの細いライン）
    ctx.beginPath();
    ctx.arc(center, center, WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#9e9e9e';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * ホイールの回転角度を CSS transform へ反映する（GPU 合成・再描画なし）。
   *
   * @param angleDeg 回転角度（度）
   */
  setAngle(angleDeg: number): void {
    this.canvas.style.transform = `rotate(${angleDeg}deg)`;
  }

  /**
   * ルーレットの状態に応じて Start / Stop ボタンの活性を切り替える。
   *
   * @param state 現在のルーレット状態
   */
  setPhase(state: RouletteState): void {
    this.phase = state;
    this.updateControls();
  }

  /**
   * 対象店の有無に応じて Start 可否と案内メッセージを切り替える。
   *
   * @param canStart 対象店が1件以上あり Start 可能か
   */
  setControlsEnabled(canStart: boolean): void {
    this.canStart = canStart;
    this.messageEl.textContent = canStart ? '' : EMPTY_MESSAGE;
    this.updateControls();
  }

  /**
   * 当選演出を再生する（オーバーレイ表示・点滅・ズーム・紙吹雪）。
   *
   * @param winner 当選したお店
   */
  playWinnerEffect(winner: Shop): void {
    this.winnerIconEl.textContent = getIconDef(winner.iconKey).emoji;
    this.winnerNameEl.textContent = winner.name; // ユーザー入力。textContent で XSS を無害化
    this.overlayEl.classList.remove('is-hidden');
    this.winnerCardEl.classList.add('is-blinking', 'is-zoomed');
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
    });
  }

  /**
   * 当選オーバーレイを閉じる（「もう一度」で idle に戻るときに main から呼ぶ）。
   */
  hideWinner(): void {
    this.overlayEl.classList.add('is-hidden');
    this.winnerCardEl.classList.remove('is-blinking', 'is-zoomed');
  }

  /** 状態（phase × canStart）からボタン活性を一元的に再計算する。 */
  private updateControls(): void {
    this.startBtn.disabled = this.phase !== 'idle' || !this.canStart;
    this.stopBtn.disabled = this.phase !== 'spinning';
  }

  /** 区画の中央角度に沿って絵文字＋店名ラベルを描画する。 */
  private drawLabel(
    ctx: CanvasRenderingContext2D,
    segment: WheelSegment,
    center: number
  ): void {
    const midDeg = (segment.startAngle + segment.endAngle) / 2;
    const midRad = toRad(midDeg - 90);
    const labelRadius = WHEEL_RADIUS * LABEL_RADIUS_RATIO;

    ctx.save();
    // ラベル位置へ移動し、文字が半径方向（外向き）に沿うよう回転する
    ctx.translate(
      center + Math.cos(midRad) * labelRadius,
      center + Math.sin(midRad) * labelRadius
    );
    ctx.rotate(midRad + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#37322e';

    ctx.font = '28px sans-serif';
    ctx.fillText(getIconDef(segment.shop.iconKey).emoji, 0, -8);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(truncate(segment.shop.name, MAX_LABEL_CHARS), 0, 14);
    ctx.restore();
  }
}

/** 度をラジアンへ変換する。 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 表示文字数を超える店名を省略記号付きで切り詰める。 */
function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
