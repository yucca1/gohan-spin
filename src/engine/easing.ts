/**
 * ルーレット減速用のイージング関数。
 *
 * easeOutQuint は cubic より終盤の減速が長く粘るため、
 * 「最後の1区画でぐっとスローになる」リーチ演出に適している。
 *
 * @param t 正規化された経過時間（0〜1）
 * @returns 正規化された進行度（0〜1）。f(0)=0, f(1)=1 で単調増加
 */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
