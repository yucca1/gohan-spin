import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopRepository } from '../../../src/repositories/ShopRepository';
import { StorageError } from '../../../src/errors';
import type { Shop } from '../../../src/types/Shop';

const STORAGE_KEY = 'gohan-spin:shops';

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: crypto.randomUUID(),
    name: 'バーガーA',
    iconKey: 'burger',
    enabled: true,
    createdAt: '2026-06-09T10:00:00.000Z',
    updatedAt: '2026-06-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('ShopRepository', () => {
  let repo: ShopRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new ShopRepository();
  });

  describe('loadAll', () => {
    it('データ未存在のとき空配列を返す', () => {
      expect(repo.loadAll()).toEqual([]);
    });

    it('保存したお店を読み込める（ラウンドトリップ）', () => {
      const shop = makeShop();
      repo.saveAll([shop]);
      expect(repo.loadAll()).toEqual([shop]);
    });

    it('JSON が破損していても例外を投げず空配列で継続する', () => {
      localStorage.setItem(STORAGE_KEY, '{壊れたJSON');
      expect(() => repo.loadAll()).not.toThrow();
      expect(repo.loadAll()).toEqual([]);
    });

    it('値が "null"（JSON.parse で null）でも空配列を返す', () => {
      // JSON.parse('null') は null を返す。typeof null === 'object' のため
      // 型ガードの null チェック分岐を確実に通す
      localStorage.setItem(STORAGE_KEY, 'null');
      expect(repo.loadAll()).toEqual([]);
    });

    it('スキーマの形が不正（shops が配列でない）なら空配列を返す', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, shops: 'not-array' })
      );
      expect(repo.loadAll()).toEqual([]);
    });
  });

  describe('saveAll', () => {
    it('version 付きスキーマで保存する', () => {
      const shop = makeShop();
      repo.saveAll([shop]);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.version).toBe(1);
      expect(parsed.shops).toHaveLength(1);
    });

    it('書き込みに失敗したら StorageError を投げる', () => {
      // jsdom の localStorage は Proxy 実装のため、プロトタイプ側を spy で差し替える
      const spy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceeded');
        });
      try {
        expect(() => repo.saveAll([makeShop()])).toThrow(StorageError);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('exists', () => {
    it('未保存なら false、保存後は true を返す', () => {
      expect(repo.exists()).toBe(false);
      repo.saveAll([makeShop()]);
      expect(repo.exists()).toBe(true);
    });
  });
});
