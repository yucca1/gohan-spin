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
