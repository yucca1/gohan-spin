import type { Shop } from './Shop';

/**
 * ホイール上の1区画（扇形）。RouletteEngine が構築し、RouletteView が描画する。
 * 複数レイヤー（engine / views / main）から参照するため types/ に置く。
 */
export interface WheelSegment {
  /** この区画に割り当てられたお店 */
  shop: Shop;
  /** 区画の開始角度（度）。12時方向を0度として時計回り */
  startAngle: number;
  /** 区画の終了角度（度）。最終区画は厳密に360（浮動小数点誤差の隙間防止） */
  endAngle: number;
  /** 区画の塗り色。隣接（円環の先頭と末尾も隣接）で被らないよう割当済み */
  color: string;
}

/**
 * ルーレットの状態機械。
 * idle → spinning（Start）→ decelerating（Stop）→ finished（着地）→ idle（リセット）
 */
export type RouletteState = 'idle' | 'spinning' | 'decelerating' | 'finished';

/**
 * 回転角度の更新通知。Engine が毎フレーム呼び、View が CSS transform へ反映する。
 */
export type AngleListener = (angleDeg: number) => void;

/**
 * ルーレット効果音の抽象（ポート）。実装は src/audio/SoundDirector が担う。
 * View は本インターフェースのみに依存し、Web Audio の実装詳細を知らない
 * （テストでは呼び出し記録を残す fake に差し替えられる）。
 */
export interface RouletteSounds {
  /** 現在音が有効か。ミュートトグル（🔊/🔇）の表示判定に使う */
  readonly enabled: boolean;
  /**
   * 音のON/OFFを切り替える。
   *
   * @returns 切り替え後の有効状態
   */
  toggle(): boolean;
  /**
   * ホイールの区画数を設定する（カチカチ音の境界通過判定に使う）。
   *
   * @param count 区画数（renderWheel した segments の件数）
   */
  setSegmentCount(count: number): void;
  /**
   * 毎フレームの回転角度を受け取り、区画境界の通過でカチカチ音を鳴らす。
   *
   * @param angleDeg ホイールの回転角度（度。減速中は360を超えて増え続ける）
   */
  handleAngle(angleDeg: number): void;
  /**
   * 状態遷移を受け取り、当選確定のファンファーレ等を再生する。
   *
   * @param state 遷移後のルーレット状態
   */
  handlePhase(state: RouletteState): void;
}
