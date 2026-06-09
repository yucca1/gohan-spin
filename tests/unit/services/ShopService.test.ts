import { describe, it, expect, beforeEach } from 'vitest';
import { ShopService } from '../../../src/services/ShopService';
import { ValidationError } from '../../../src/errors';
import { InMemoryShopRepository } from '../../helpers/InMemoryShopRepository';
import type { Shop } from '../../../src/types/Shop';

describe('ShopService', () => {
  let repo: InMemoryShopRepository;
  let service: ShopService;

  beforeEach(() => {
    repo = new InMemoryShopRepository();
    service = new ShopService(repo);
  });

  describe('create', () => {
    it('正常な入力でお店を作成でき、enabled は true になる', () => {
      // Given / When
      const shop = service.create({ name: 'バーガーA', iconKey: 'burger' });
      // Then
      expect(shop.id).toBeDefined();
      expect(shop.enabled).toBe(true);
      expect(shop.name).toBe('バーガーA');
      expect(shop.iconKey).toBe('burger');
      expect(shop.createdAt).toBe(shop.updatedAt);
      // ISO 8601 文字列であること
      expect(new Date(shop.createdAt).toISOString()).toBe(shop.createdAt);
    });

    it('作成したお店が永続化される', () => {
      service.create({ name: 'ラーメンB', iconKey: 'ramen' });
      expect(repo.loadAll()).toHaveLength(1);
    });

    it('店名は前後の空白を trim して保存する', () => {
      const shop = service.create({ name: '  カフェC  ', iconKey: 'cafe' });
      expect(shop.name).toBe('カフェC');
    });

    it('店名が空文字なら ValidationError を投げる', () => {
      expect(() => service.create({ name: '', iconKey: 'burger' })).toThrow(
        ValidationError,
      );
    });

    it('ValidationError は field と value を保持する', () => {
      try {
        service.create({ name: '', iconKey: 'burger' });
        expect.fail('ValidationError が投げられるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.field).toBe('name');
        expect(validationError.value).toBe('');
      }
    });

    it('店名が空白のみなら ValidationError を投げる', () => {
      expect(() =>
        service.create({ name: '   ', iconKey: 'burger' }),
      ).toThrow(ValidationError);
    });

    it('店名が1文字（境界・下限）なら作成できる', () => {
      const shop = service.create({ name: 'A', iconKey: 'burger' });
      expect(shop.name).toBe('A');
    });

    it('店名が50文字（境界・上限）なら作成できる', () => {
      const name = 'あ'.repeat(50);
      const shop = service.create({ name, iconKey: 'burger' });
      expect(shop.name).toBe(name);
    });

    it('店名が51文字（境界・超過）なら ValidationError を投げる', () => {
      const name = 'あ'.repeat(51);
      expect(() => service.create({ name, iconKey: 'burger' })).toThrow(
        ValidationError,
      );
    });

    it('iconKey が許可値でないなら ValidationError を投げる', () => {
      expect(() =>
        // @ts-expect-error 不正な iconKey を意図的に渡す
        service.create({ name: '店', iconKey: 'invalid' }),
      ).toThrow(ValidationError);
    });

    it('100件まで登録でき、101件目は ValidationError を投げる', () => {
      const shops: Shop[] = Array.from({ length: 100 }, (_, i) => ({
        id: crypto.randomUUID(),
        name: `店${i}`,
        iconKey: 'other' as const,
        enabled: true,
        createdAt: '2026-06-09T10:00:00.000Z',
        updatedAt: '2026-06-09T10:00:00.000Z',
      }));
      repo.saveAll(shops);
      expect(() =>
        service.create({ name: '101件目', iconKey: 'burger' }),
      ).toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('カテゴリ順（IconDef.order 昇順）でソートして返す', () => {
      service.create({ name: 'カフェ', iconKey: 'cafe' }); // order 6
      service.create({ name: 'バーガー', iconKey: 'burger' }); // order 1
      service.create({ name: 'ラーメン', iconKey: 'ramen' }); // order 2

      const names = service.list().map((s) => s.name);
      expect(names).toEqual(['バーガー', 'ラーメン', 'カフェ']);
    });

    it('同カテゴリ内は createdAt 昇順でソートする', () => {
      repo.saveAll([
        {
          id: crypto.randomUUID(),
          name: '後',
          iconKey: 'burger',
          enabled: true,
          createdAt: '2026-06-09T12:00:00.000Z',
          updatedAt: '2026-06-09T12:00:00.000Z',
        },
        {
          id: crypto.randomUUID(),
          name: '先',
          iconKey: 'burger',
          enabled: true,
          createdAt: '2026-06-09T09:00:00.000Z',
          updatedAt: '2026-06-09T09:00:00.000Z',
        },
      ]);
      const names = service.list().map((s) => s.name);
      expect(names).toEqual(['先', '後']);
    });

    it('お店が無いときは空配列を返す', () => {
      expect(service.list()).toEqual([]);
    });
  });
});
