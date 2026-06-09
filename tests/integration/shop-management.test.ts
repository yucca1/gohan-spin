import { describe, it, expect, beforeEach } from 'vitest';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { ShopService } from '../../src/services/ShopService';

/**
 * ShopService + 実 ShopRepository（jsdom の localStorage）の統合テスト。
 * 一覧管理（編集・対象切替・削除）の永続化ラウンドトリップを検証する。
 */
describe('shop management (ShopService + ShopRepository)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('編集 → 別インスタンスで再読込しても更新内容が一致する', () => {
    // Given: 登録して編集
    const writeService = new ShopService(new ShopRepository());
    const created = writeService.create({ name: '旧店名', iconKey: 'burger' });
    const updated = writeService.update(created.id, {
      name: '新店名',
      iconKey: 'ramen',
    });

    // When: アプリ再起動を模して読み直す
    const readService = new ShopService(new ShopRepository());
    const loaded = readService.list();

    // Then: 編集後の内容が永続化されている
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(updated);
    expect(loaded[0].name).toBe('新店名');
    expect(loaded[0].iconKey).toBe('ramen');
    expect(loaded[0].createdAt).toBe(created.createdAt); // createdAt は不変
  });

  it('対象切替 → 再読込で enabled 状態が保持される', () => {
    const writeService = new ShopService(new ShopRepository());
    const created = writeService.create({ name: '店', iconKey: 'burger' });
    writeService.toggleEnabled(created.id, false);

    const readService = new ShopService(new ShopRepository());
    expect(readService.list()[0].enabled).toBe(false);
    // listEnabled は対象外を除外する
    expect(readService.listEnabled()).toEqual([]);
  });

  it('削除 → 再読込で復活しない', () => {
    const writeService = new ShopService(new ShopRepository());
    const a = writeService.create({ name: 'A', iconKey: 'burger' });
    writeService.create({ name: 'B', iconKey: 'ramen' });
    writeService.remove(a.id);

    const readService = new ShopService(new ShopRepository());
    const names = readService.list().map((s) => s.name);
    expect(names).toEqual(['B']);
  });
});
