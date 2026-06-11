import { describe, it, expect } from 'vitest';
import { easeOutQuint } from '../../../src/engine/easing';

describe('easeOutQuint', () => {
  it('f(0) = 0 になる', () => {
    expect(easeOutQuint(0)).toBe(0);
  });

  it('f(1) = 1 になる', () => {
    expect(easeOutQuint(1)).toBe(1);
  });

  it('0〜1 の範囲で単調増加する', () => {
    // Given: 0〜1 を細かく刻んだサンプル点
    const steps = 100;
    // When / Then: 隣り合う点で値が常に増加している
    for (let i = 0; i < steps; i++) {
      const prev = easeOutQuint(i / steps);
      const next = easeOutQuint((i + 1) / steps);
      expect(next).toBeGreaterThan(prev);
    }
  });

  it('終盤（t=0.8以降）の進みが序盤（t=0.2まで）より小さい（ease-out特性）', () => {
    // リーチ演出の根拠となる「終盤が粘る」性質を確認する
    const earlyGain = easeOutQuint(0.2) - easeOutQuint(0);
    const lateGain = easeOutQuint(1) - easeOutQuint(0.8);
    expect(lateGain).toBeLessThan(earlyGain);
  });
});
