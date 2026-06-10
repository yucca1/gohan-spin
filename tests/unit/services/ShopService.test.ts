import { describe, it, expect, beforeEach } from 'vitest';
import { ShopService } from '../../../src/services/ShopService';
import { ValidationError, NotFoundError } from '../../../src/errors';
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
        ValidationError
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
      expect(() => service.create({ name: '   ', iconKey: 'burger' })).toThrow(
        ValidationError
      );
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
        ValidationError
      );
    });

    it('iconKey が許可値でないなら ValidationError を投げる', () => {
      expect(() =>
        // @ts-expect-error 不正な iconKey を意図的に渡す
        service.create({ name: '店', iconKey: 'invalid' })
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
        service.create({ name: '101件目', iconKey: 'burger' })
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

  describe('listEnabled', () => {
    it('enabled=true のお店のみをカテゴリ順で返す', () => {
      const cafe = service.create({ name: 'カフェ', iconKey: 'cafe' }); // order 6
      service.create({ name: 'バーガー', iconKey: 'burger' }); // order 1
      const ramen = service.create({ name: 'ラーメン', iconKey: 'ramen' }); // order 2
      // バーガーだけ対象から外す
      service.toggleEnabled(
        service.list().find((s) => s.name === 'バーガー')!.id,
        false
      );

      const names = service.listEnabled().map((s) => s.name);
      expect(names).toEqual(['ラーメン', 'カフェ']);
      // 参照を握りつぶしていないこと（ramen/cafe は enabled のまま）
      expect(ramen.enabled).toBe(true);
      expect(cafe.enabled).toBe(true);
    });

    it('全件 disabled なら空配列を返す', () => {
      const shop = service.create({ name: '店', iconKey: 'burger' });
      service.toggleEnabled(shop.id, false);
      expect(service.listEnabled()).toEqual([]);
    });
  });

  describe('update', () => {
    it('店名のみを更新でき、アイコンと enabled は変わらない', () => {
      const created = service.create({ name: '旧名', iconKey: 'burger' });
      const updated = service.update(created.id, { name: '新名' });
      expect(updated.name).toBe('新名');
      expect(updated.iconKey).toBe('burger');
      expect(updated.enabled).toBe(true);
    });

    it('アイコンのみを更新できる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const updated = service.update(created.id, { iconKey: 'ramen' });
      expect(updated.iconKey).toBe('ramen');
      expect(updated.name).toBe('店');
    });

    it('enabled=false への部分更新ができる（falsy でも反映される）', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const updated = service.update(created.id, { enabled: false });
      expect(updated.enabled).toBe(false);
    });

    it('enabled=false のお店の名前を更新しても enabled は false のまま', () => {
      const created = service.create({ name: '旧', iconKey: 'burger' });
      service.toggleEnabled(created.id, false);
      const updated = service.update(created.id, { name: '新' });
      expect(updated.enabled).toBe(false);
    });

    it('店名は前後の空白を trim して保存する', () => {
      const created = service.create({ name: '旧', iconKey: 'burger' });
      const updated = service.update(created.id, { name: '  新名  ' });
      expect(updated.name).toBe('新名');
    });

    it('updatedAt を更新し、id と createdAt は不変', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const updated = service.update(created.id, { name: '別名' });
      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
      // updatedAt は ISO 8601 文字列で、createdAt 以上（同時刻含む）
      expect(new Date(updated.updatedAt).toISOString()).toBe(updated.updatedAt);
      expect(updated.updatedAt >= created.updatedAt).toBe(true);
    });

    it('更新内容が永続化される', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      service.update(created.id, { name: '保存名' });
      expect(repo.loadAll()[0].name).toBe('保存名');
    });

    it('店名が空文字なら ValidationError を投げる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      expect(() => service.update(created.id, { name: '' })).toThrow(
        ValidationError
      );
    });

    it('店名が51文字（境界・超過）なら ValidationError を投げる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const name = 'あ'.repeat(51);
      expect(() => service.update(created.id, { name })).toThrow(
        ValidationError
      );
    });

    it('店名が50文字（境界・上限）なら更新できる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const name = 'あ'.repeat(50);
      expect(service.update(created.id, { name }).name).toBe(name);
    });

    it('iconKey が許可値でないなら ValidationError を投げる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      expect(() =>
        // @ts-expect-error 不正な iconKey を意図的に渡す
        service.update(created.id, { iconKey: 'invalid' })
      ).toThrow(ValidationError);
    });

    it('存在しない id なら NotFoundError を投げる', () => {
      expect(() => service.update('missing-id', { name: '名' })).toThrow(
        NotFoundError
      );
    });
  });

  describe('toggleEnabled', () => {
    it('true → false に切り替えられる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const toggled = service.toggleEnabled(created.id, false);
      expect(toggled.enabled).toBe(false);
    });

    it('false → true に切り替えられる', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      service.toggleEnabled(created.id, false);
      const toggled = service.toggleEnabled(created.id, true);
      expect(toggled.enabled).toBe(true);
    });

    it('切替結果が永続化される', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      service.toggleEnabled(created.id, false);
      expect(repo.loadAll()[0].enabled).toBe(false);
    });

    it('切替時に updatedAt が更新される', () => {
      const created = service.create({ name: '店', iconKey: 'burger' });
      const toggled = service.toggleEnabled(created.id, false);
      expect(new Date(toggled.updatedAt).toISOString()).toBe(toggled.updatedAt);
      expect(toggled.updatedAt >= created.updatedAt).toBe(true);
    });

    it('存在しない id なら NotFoundError を投げる', () => {
      expect(() => service.toggleEnabled('missing-id', false)).toThrow(
        NotFoundError
      );
    });
  });

  describe('remove', () => {
    it('お店を削除すると件数が減る', () => {
      const a = service.create({ name: 'A', iconKey: 'burger' });
      service.create({ name: 'B', iconKey: 'ramen' });
      service.remove(a.id);
      const names = service.list().map((s) => s.name);
      expect(names).toEqual(['B']);
    });

    it('削除が永続化される', () => {
      const a = service.create({ name: 'A', iconKey: 'burger' });
      service.remove(a.id);
      expect(repo.loadAll()).toHaveLength(0);
    });

    it('存在しない id なら NotFoundError を投げる', () => {
      expect(() => service.remove('missing-id')).toThrow(NotFoundError);
    });
  });
});
