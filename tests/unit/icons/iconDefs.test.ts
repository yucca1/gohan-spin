import { describe, it, expect } from 'vitest';
import {
  ICON_DEFS,
  getIconDef,
  isIconKey,
  getIconOrder,
} from '../../../src/icons/iconDefs';

describe('iconDefs', () => {
  describe('ICON_DEFS', () => {
    it('order が昇順で定義されている', () => {
      const orders = ICON_DEFS.map((def) => def.order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    });

    it('全エントリに emoji と label が設定されている', () => {
      for (const def of ICON_DEFS) {
        expect(def.emoji.length).toBeGreaterThan(0);
        expect(def.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getIconDef', () => {
    it('既知のキーで対応する定義を返す', () => {
      const def = getIconDef('ramen');
      expect(def.key).toBe('ramen');
      expect(def.emoji).toBe('🍜');
    });

    it('未知のキーは other にフォールバックする', () => {
      // @ts-expect-error 未知のキーを意図的に渡してフォールバックを検証する
      const def = getIconDef('unknown');
      expect(def.key).toBe('other');
    });
  });

  describe('isIconKey', () => {
    it('許可値には true を返す', () => {
      expect(isIconKey('burger')).toBe(true);
      expect(isIconKey('other')).toBe(true);
    });

    it('許可値以外には false を返す', () => {
      expect(isIconKey('unknown')).toBe(false);
      expect(isIconKey('')).toBe(false);
    });
  });

  describe('getIconOrder', () => {
    it('カテゴリの order を返す', () => {
      expect(getIconOrder('burger')).toBe(1);
      expect(getIconOrder('other')).toBe(99);
    });
  });
});
