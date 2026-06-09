import type { Shop } from '../../src/types/Shop';

/**
 * テスト用のインメモリ ShopRepository 実装。
 *
 * 本物の ShopRepository（localStorage）と同じ公開メソッドを持つため、
 * 構造的型付けにより ShopService にそのまま注入できる。
 * localStorage に依存せず、ShopService のロジックを純粋に検証する目的で使う。
 */
export class InMemoryShopRepository {
  private shops: Shop[] = [];
  private saved = false;

  loadAll(): Shop[] {
    // 防御的コピーを返し、外部からの破壊的変更を防ぐ
    return [...this.shops];
  }

  saveAll(shops: Shop[]): void {
    this.shops = [...shops];
    this.saved = true;
  }

  exists(): boolean {
    return this.saved;
  }
}
