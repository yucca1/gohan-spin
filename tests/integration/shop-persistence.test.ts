import { describe, it, expect, beforeEach } from 'vitest';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { ShopService } from '../../src/services/ShopService';

const STORAGE_KEY = 'gohan-spin:shops';

/**
 * ShopService + 実 ShopRepository（jsdom の localStorage）の統合テスト。
 * レイヤーをまたいだ永続化ラウンドトリップと、破損データ耐性を検証する。
 */
describe('shop persistence (ShopService + ShopRepository)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('登録 → 別インスタンスで再読込してもデータが一致する', () => {
    // Given: あるセッションでお店を登録
    const writeService = new ShopService(new ShopRepository());
    const created = writeService.create({
      name: '〇〇バーガー 駅前店',
      iconKey: 'burger',
    });

    // When: アプリ再起動を模してインスタンスを作り直して読み込む
    const readService = new ShopService(new ShopRepository());
    const loaded = readService.list();

    // Then: 永続化された内容が一致する
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(created);
  });

  it('複数登録がカテゴリ順で復元される', () => {
    const service = new ShopService(new ShopRepository());
    service.create({ name: 'カフェ', iconKey: 'cafe' });
    service.create({ name: 'バーガー', iconKey: 'burger' });

    const reloaded = new ShopService(new ShopRepository()).list();
    expect(reloaded.map((s) => s.name)).toEqual(['バーガー', 'カフェ']);
  });

  it('localStorage が破損していても list は空配列で継続する', () => {
    // Given: 破損した JSON を直接書き込む
    localStorage.setItem(STORAGE_KEY, '{不正なデータ');

    // When / Then: 例外を投げず空で継続する
    const service = new ShopService(new ShopRepository());
    expect(() => service.list()).not.toThrow();
    expect(service.list()).toEqual([]);
  });
});
