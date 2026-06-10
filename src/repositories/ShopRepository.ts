import type { Shop } from '../types/Shop';
import type { ShopStoreSchema } from '../types/ShopStoreSchema';
import { SCHEMA_VERSION } from '../types/ShopStoreSchema';
import { StorageError } from '../errors';

/** localStorage 上のお店データのキー。 */
const STORAGE_KEY = 'gohan-spin:shops';

/**
 * 値が ShopStoreSchema の形をしているかをざっくり検証する。
 * 厳密な各 Shop の型までは見ない（破損検知が目的。詳細検証は Service の責務）。
 */
function isShopStoreSchema(value: unknown): value is ShopStoreSchema {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'number' && Array.isArray(candidate.shops)
  );
}

/**
 * お店データの永続化レイヤー。
 *
 * localStorage への読み書きと JSON シリアライズ、破損・容量超過のフォールバックを担う。
 * ビジネスロジックは持たない（CRUD・バリデーションは ShopService の責務）。
 *
 * インスタンス状態を持たないため、テストではインメモリ実装に構造的に差し替えできる。
 */
export class ShopRepository {
  /**
   * お店データを全件読み込む。
   *
   * データ未存在・JSON 破損・形が不正な場合は、例外を投げず空配列を返して継続する
   * （アプリをクラッシュさせないためのフォールバック）。
   */
  loadAll(): Shop[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!isShopStoreSchema(parsed)) return [];
      return parsed.shops;
    } catch {
      // JSON.parse 失敗（破損）や localStorage アクセス不可でも空で継続する
      return [];
    }
  }

  /**
   * お店データを全件保存する。
   *
   * @throws {StorageError} 容量超過などで書き込みに失敗した場合
   */
  saveAll(shops: Shop[]): void {
    const data: ShopStoreSchema = { version: SCHEMA_VERSION, shops };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (cause) {
      throw new StorageError(
        '保存に失敗しました。不要なお店を削除してください',
        { cause }
      );
    }
  }

  /**
   * お店データが保存済みか（初回起動判定などの UX 分岐用）。
   */
  exists(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}
