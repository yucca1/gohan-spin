import type { Shop, CreateShopInput, UpdateShopInput } from '../types/Shop';
import type { ShopRepository } from '../repositories/ShopRepository';
import { isIconKey, getIconOrder } from '../icons/iconDefs';
import { ValidationError, NotFoundError } from '../errors';

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
 * 更新系（update / toggleEnabled / remove）は「全件 load → 配列を加工 → 全件 save」の
 * 単純戦略を採る（お店は最大 100 件のため、全件書き換えで性能上の問題はない）。
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
        shops.length
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
   * ルーレット対象（enabled = true）のお店のみを、list() と同じカテゴリ順で返す。
   *
   * 後続のルーレット機能（RouletteEngine.build）への供給口。
   * 「チェックOFFのお店はルーレット対象から除外される」要件をここで満たす。
   */
  listEnabled(): Shop[] {
    return this.list().filter((shop) => shop.enabled);
  }

  /**
   * お店を部分更新する。渡されたフィールドのみ検証・更新する。
   *
   * id / createdAt は不変で、更新があれば updatedAt を現在時刻に更新する。
   * 店名は前後の空白を trim して保存する。
   *
   * @throws {NotFoundError} 対象の id が存在しない場合
   * @throws {ValidationError} 渡されたフィールドが不正な場合
   * @throws {StorageError} localStorage への保存に失敗した場合
   */
  update(id: string, input: UpdateShopInput): Shop {
    const shops = this.repo.loadAll();
    const index = this.findIndexOrThrow(shops, id);

    if (input.name !== undefined) this.validateName(input.name);
    if (input.iconKey !== undefined) this.validateIconKey(input.iconKey);

    const current = shops[index];
    const updated: Shop = {
      ...current,
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.iconKey !== undefined && { iconKey: input.iconKey }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      updatedAt: new Date().toISOString(),
    };

    const next = [...shops];
    next[index] = updated;
    this.repo.saveAll(next);
    return updated;
  }

  /**
   * お店のルーレット対象フラグ（enabled）を切り替える。update への薄いラッパ。
   *
   * @throws {NotFoundError} 対象の id が存在しない場合
   * @throws {StorageError} localStorage への保存に失敗した場合
   */
  toggleEnabled(id: string, enabled: boolean): Shop {
    return this.update(id, { enabled });
  }

  /**
   * お店を削除する。削除後の全件を保存する。
   *
   * @throws {NotFoundError} 対象の id が存在しない場合
   * @throws {StorageError} localStorage への保存に失敗した場合
   */
  remove(id: string): void {
    const shops = this.repo.loadAll();
    const next = shops.filter((shop) => shop.id !== id);
    if (next.length === shops.length) {
      throw new NotFoundError(id);
    }
    this.repo.saveAll(next);
  }

  /**
   * 登録入力を検証する。NG の場合は ValidationError を throw する。
   */
  private validate(input: CreateShopInput): void {
    this.validateName(input.name);
    this.validateIconKey(input.iconKey);
  }

  /**
   * 店名を検証する（trim 後 1〜50 文字）。create / update で共通利用する。
   */
  private validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_NAME_LENGTH) {
      throw new ValidationError(
        `店名は1〜${MAX_NAME_LENGTH}文字で入力してください`,
        'name',
        name
      );
    }
  }

  /**
   * アイコンキーが許可値かを検証する。create / update で共通利用する。
   */
  private validateIconKey(iconKey: string): void {
    if (!isIconKey(iconKey)) {
      throw new ValidationError(
        'アイコンを選択してください',
        'iconKey',
        iconKey
      );
    }
  }

  /**
   * id 一致のお店の添字を返す。見つからなければ NotFoundError を throw する。
   */
  private findIndexOrThrow(shops: Shop[], id: string): number {
    const index = shops.findIndex((shop) => shop.id === id);
    if (index === -1) {
      throw new NotFoundError(id);
    }
    return index;
  }
}
