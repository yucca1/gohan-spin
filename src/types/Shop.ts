import type { IconKey } from './IconKey';

/**
 * お店エンティティ。localStorage に永続化される。
 */
export interface Shop {
  /** UUID v4（crypto.randomUUID() で採番、不変） */
  id: string;
  /** 店名。trim 後 1〜50 文字（必須） */
  name: string;
  /** アイコンのキー文字列（絵文字へはマップ経由で解決） */
  iconKey: IconKey;
  /** ルーレット対象フラグ。登録直後は true（デフォルト ON） */
  enabled: boolean;
  /** 作成日時（ISO 8601 文字列） */
  createdAt: string;
  /** 更新日時（ISO 8601 文字列） */
  updatedAt: string;
  // --- Post-MVP 拡張予約（MVP では未使用）---
  // url?: string; // お店の外部リンク（P1 で追加予定）
}

/**
 * お店登録の入力。
 */
export interface CreateShopInput {
  name: string;
  iconKey: IconKey;
}

/**
 * お店更新の入力（部分更新）。
 * MVP の登録機能では未使用だが、後続の一覧管理機能で使用する。
 */
export interface UpdateShopInput {
  name?: string;
  iconKey?: IconKey;
  enabled?: boolean;
}
