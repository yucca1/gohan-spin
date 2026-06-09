import type { Shop } from './Shop';

/**
 * 現在のスキーマバージョン。
 * スキーマ（保存形式）を変更したらインクリメントし、
 * 読み込み時にマイグレーションの分岐に使う（例: Post-MVP の Shop.url 追加時）。
 */
export const SCHEMA_VERSION = 1;

/**
 * localStorage に保存するお店データのスキーマ。
 * キー: `gohan-spin:shops`、値はこのオブジェクトの JSON 文字列。
 */
export interface ShopStoreSchema {
  version: number;
  shops: Shop[];
}
