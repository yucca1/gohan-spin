import type { Shop } from '../types/Shop';
import type {
  WheelSegment,
  RouletteState,
  AngleListener,
} from '../types/Roulette';
import { easeOutQuint } from './easing';

/** 等速回転の速度（度/ミリ秒）。1.0 = 1秒で1000度（実機の動作確認を経て調整済み）。 */
const SPIN_SPEED_DEG_PER_MS = 1.0;
/**
 * easeOutQuint の初速係数（導関数 f'(t) = 5(1-t)^4 より f'(0) = 5）。
 * 減速の初速 = 係数 × 総距離 ÷ 所要時間。等速回転との速度連続性の計算に使う。
 */
const DECEL_INITIAL_SPEED_FACTOR = 5;
/**
 * 減速中に必ず回る最低周回数。着地点まで最低この周数を回ってから止まる。
 * 5周にすることで減速時間が約9〜10.8秒（≒10秒）になり、ドキドキする時間を確保する。
 */
const MIN_FULL_TURNS = 5;

/**
 * 区画の塗り色パレット（10色）。
 * 色は「お店」に対して安定的に割り当てる（初登場順に循環割当）。
 * ラベル（濃色の文字）が読みやすい明るめトーンで揃え、連続する色の色相が
 * 近くならない並び順にしている（連番で割り当てられた隣同士が見分けやすい）。
 */
const SEGMENT_PALETTE = [
  '#ff8a65', // コーラル
  '#4fc3f7', // スカイブルー
  '#ffd54f', // イエロー
  '#aed581', // ライトグリーン
  '#ba68c8', // パープル
  '#4db6ac', // ティール
  '#f06292', // ピンク
  '#ffb74d', // オレンジ
  '#90a4ae', // ブルーグレー
  '#a1887d', // モカ
] as const;

/**
 * 同色の隣接（円環の先頭と末尾も隣接）を避けるための再シャッフル試行回数の上限。
 * 色はお店に固定のため、隣接回避は色変更ではなく並び直しで行う。
 * 上限到達時は同色隣接を許容する（パレット10色に対し対象店が多い場合の保険）。
 */
const MAX_SHUFFLE_ATTEMPTS = 20;

/**
 * ルーレットの計算ロジック（回転・減速・当選判定）を担う Engine 層。
 *
 * DOM に依存しない純粋計算に寄せ、描画は onUpdate コールバック経由で View に委ねる。
 * 「先に停止角度を乱数で決め、その角度から当選店を逆算する」方式により、
 * 当選は完全ランダムで公平になり、アニメーションは見せ方に専念できる。
 */
export class RouletteEngine {
  private currentState: RouletteState = 'idle';
  private segments: WheelSegment[] = [];
  private currentAngle = 0;
  private rafId: number | null = null;
  private lastTime = 0;
  /**
   * お店ごとの色の割当表（shop.id → 色）。
   * 色を区画の位置ではなくお店に紐づけることで、「もう一度」や再シャッフルの後も
   * 同じお店が同じ色のまま表示される（位置基準だとbuildのたびに色が変わってしまう）。
   */
  private readonly colorByShopId = new Map<string, string>();

  /** 現在の状態。main がアイドル判定（ホイール再構築の可否）に使う。 */
  get state(): RouletteState {
    return this.currentState;
  }

  /**
   * 対象店からホイール区画を構築する。
   *
   * Fisher-Yates シャッフルでランダム順に並べ（一覧のカテゴリ順とは独立）、
   * 360度を等分割り当てる。構築した区画は当選判定用に内部にも保持する。
   *
   * @param enabledShops ルーレット対象（enabled=true）のお店
   * @returns 構築した区画。空配列を渡すと空配列を返す
   */
  build(enabledShops: Shop[]): WheelSegment[] {
    // 空配列は早期リターン（360 / 0 = Infinity の計算を避ける防御）
    if (enabledShops.length === 0) {
      this.segments = [];
      return [];
    }

    // 初登場のお店にパレットを循環割当する（既存のお店の色は変えない）
    for (const shop of enabledShops) {
      if (!this.colorByShopId.has(shop.id)) {
        this.colorByShopId.set(
          shop.id,
          SEGMENT_PALETTE[this.colorByShopId.size % SEGMENT_PALETTE.length]
        );
      }
    }

    // 同色（パレット一周後の11店目以降）が隣り合わない並びを再シャッフルで探す
    let shuffled = shuffle(enabledShops);
    for (
      let attempt = 0;
      attempt < MAX_SHUFFLE_ATTEMPTS && this.hasAdjacentSameColor(shuffled);
      attempt++
    ) {
      shuffled = shuffle(enabledShops);
    }

    const anglePerShop = 360 / shuffled.length;

    this.segments = shuffled.map((shop, i) => ({
      shop,
      startAngle: i * anglePerShop,
      // 最終区画は厳密に360へ固定（浮動小数点誤差で隙間が生じ当選判定に穴が開くのを防ぐ）
      endAngle: i === shuffled.length - 1 ? 360 : (i + 1) * anglePerShop,
      color: this.colorOf(shop),
    }));
    return this.segments;
  }

  /**
   * 等速回転を開始する（idle → spinning）。
   *
   * requestAnimationFrame で毎フレーム経過時間ぶん角度を加算し、onUpdate へ通知する。
   * idle 以外の状態では何もしない（多重スタート防止）。
   *
   * @param onUpdate 毎フレームの角度通知先（View が CSS へ反映する）
   */
  start(onUpdate: AngleListener): void {
    if (this.currentState !== 'idle' || this.segments.length === 0) return;

    this.currentState = 'spinning';
    this.lastTime = performance.now();
    const tick = (now: number) => {
      // stop() で state が変わったらこのループは静かに抜ける
      if (this.currentState !== 'spinning') return;
      const elapsed = now - this.lastTime;
      this.lastTime = now;
      this.currentAngle =
        (this.currentAngle + SPIN_SPEED_DEG_PER_MS * elapsed) % 360;
      onUpdate(this.currentAngle);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * 減速を開始し、ランダムな停止角度へ着地する（spinning → decelerating → finished）。
   *
   * 停止角度を先に乱数で決め、easeOutQuint（終盤が粘る）で補間することで
   * リーチ演出と公平な抽選を両立する。着地時に onFinish(winner) を一度だけ呼ぶ。
   *
   * 所要時間は固定値ではなく「総距離と等速回転スピード」から逆算する。
   * これにより減速の初速が等速回転の速度と一致し、Stop 直後に
   * 一瞬加速して見える違和感をなくす（速度の連続性）。
   *
   * @param onUpdate 毎フレームの角度通知先（start と同一のものを渡す）
   * @param onFinish 着地時に当選店を受け取るコールバック
   */
  stop(onUpdate: AngleListener, onFinish: (winner: Shop) => void): void {
    if (this.currentState !== 'spinning') return;

    this.currentState = 'decelerating';
    const from = this.currentAngle;
    const landing = Math.random() * 360; // 着地点（完全ランダム＝抽選の本体）
    // 現在角度から着地点まで、最低 MIN_FULL_TURNS 周回ってから止まる総距離
    const offsetToLanding = (((landing - from) % 360) + 360) % 360;
    const distance = MIN_FULL_TURNS * 360 + offsetToLanding;
    const to = from + distance;
    // easeOutQuint の初速は「係数5 × 総距離 ÷ 所要時間」。これが等速回転の速度と
    // 一致するよう所要時間を逆算する（distance が 1800〜2160 度のため約 9〜10.8 秒）
    const durationMs =
      (DECEL_INITIAL_SPEED_FACTOR * distance) / SPIN_SPEED_DEG_PER_MS;
    const startTime = performance.now();

    const tick = (now: number) => {
      if (this.currentState !== 'decelerating') return; // reset() で中断可能にする
      const t = Math.min((now - startTime) / durationMs, 1);
      this.currentAngle = from + (to - from) * easeOutQuint(t);
      onUpdate(this.currentAngle);
      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.currentState = 'finished';
        this.rafId = null;
        onFinish(this.getWinner(to));
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * ホイールの回転角度から、上部の針（12時方向）が指す当選店を判定する。
   *
   * @param finalAngleDeg ホイールの最終回転角度（度。負や360超も可）
   * @returns 針の真下にある区画のお店
   */
  getWinner(finalAngleDeg: number): Shop {
    // ホイールが時計回りに回転 ⇒ 針はホイール座標系では逆向きに移動したのと等価。
    // JS の % は負を返しうるため二重に mod を取り 0〜360 未満へ正規化する
    const pointer = (((360 - (finalAngleDeg % 360)) % 360) + 360) % 360;
    const seg = this.segments.find((s, i) => {
      // 最終区画は end を 360 として扱い、pointer=0 や浮動小数点誤差の穴を防ぐ
      const end = i === this.segments.length - 1 ? 360 : s.endAngle;
      return pointer >= s.startAngle && pointer < end;
    });
    return (seg ?? this.segments[0]).shop; // 念のためのフォールバック
  }

  /**
   * アニメーションを停止し idle へ戻す（「もう一度」用）。
   * どの状態からでも呼べる。角度も 0 に戻し、View 側の表示リセットと一致させる
   * （角度を保持すると、再構築したホイールが回転したまま表示されてしまう）。
   */
  reset(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.currentState = 'idle';
    this.currentAngle = 0;
  }

  /** お店の割当色を返す。build 内で割当済みのため通常は必ず見つかる（?? は防御）。 */
  private colorOf(shop: Shop): string {
    return this.colorByShopId.get(shop.id) ?? SEGMENT_PALETTE[0];
  }

  /** 円環上（先頭と末尾も隣接）で同色のお店が隣り合うかを判定する。 */
  private hasAdjacentSameColor(shops: Shop[]): boolean {
    if (shops.length < 2) return false;
    return shops.some((shop, i) => {
      const next = shops[(i + 1) % shops.length];
      return this.colorOf(shop) === this.colorOf(next);
    });
  }
}

/**
 * Fisher-Yates シャッフル。元配列は変更せずコピーを返す。
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
