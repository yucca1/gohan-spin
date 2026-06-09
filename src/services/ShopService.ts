import type { Shop, CreateShopInput } from '../types/Shop';
import type { ShopRepository } from '../repositories/ShopRepository';
import { isIconKey, getIconOrder } from '../icons/iconDefs';
import { ValidationError } from '../errors';

/** 店名の最大文字数（trim 後）。 */
const MAX_NAME_LENGTH = 50;
/** 登録できるお店の最大件数。 */
const MAX_SHOPS = 100;

/**
 * お店のビジネスロジック（登録・一覧）を担うサービス層。
 *
 * localStorage は同期 API のため、メソッドは Promise を返さず同期で実装する。
 * DOM にも localStorage にも直接依存せず、永続化は Repository に委譲する。
 *
 * NOTE: update / toggleEnabled / remove / listEnabled は後続の
 * 一覧管理・ルーレット機能で追加する（本フェーズのスコープ外）。
 */
export class ShopService {
  constructor(private readonly repo: ShopRepository) {}

  /**
   * お店を登録する。
   *
   * 採番（UUID）・enabled=true・作成/更新日時の付与を行い、全件を保存する。
   *
   * @throws {ValidationError} 入力が不正、または登録上限に達している場合
   * @throws {StorageError} localStorage への保存に失敗した場合
   */
  create(input: CreateShopInput): Shop {
    this.validate(input);

    const shops = this.repo.loadAll();
    if (shops.length >= MAX_SHOPS) {
      throw new ValidationError(
        `お店は最大${MAX_SHOPS}件まで登録できます`,
        'shops',
        shops.length,
      );
    }

    const now = new Date().toISOString();
    const shop: Shop = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      iconKey: input.iconKey,
      enabled: true, // 登録直後はルーレット対象 ON（デフォルト）
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveAll([...shops, shop]);
    return shop;
  }

  /**
   * 全件をカテゴリ順（IconDef.order 昇順 → 同カテゴリ内は createdAt 昇順）で返す。
   *
   * createdAt は ISO 8601 文字列のため、文字列比較がそのまま時刻の昇順になる。
   */
  list(): Shop[] {
    return [...this.repo.loadAll()].sort((a, b) => {
      const orderDiff = getIconOrder(a.iconKey) - getIconOrder(b.iconKey);
      if (orderDiff !== 0) return orderDiff;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  /**
   * 登録入力を検証する。NG の場合は ValidationError を throw する。
   */
  private validate(input: CreateShopInput): void {
    const name = input.name.trim();
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      throw new ValidationError(
        `店名は1〜${MAX_NAME_LENGTH}文字で入力してください`,
        'name',
        input.name,
      );
    }
    if (!isIconKey(input.iconKey)) {
      throw new ValidationError(
        'アイコンを選択してください',
        'iconKey',
        input.iconKey,
      );
    }
  }
}
