import type { IconDef, IconKey } from '../types/IconKey';

/**
 * IconKey → 絵文字・ラベル・並び順 の静的解決マップ（MVP は絵文字）。
 *
 * 将来 SVG アイコンセットへ差し替える際は、このマップの解決先を変えるだけでよい。
 * order の昇順で定義しており、これが一覧の「カテゴリ順ソート」の基準になる。
 */
export const ICON_DEFS: readonly IconDef[] = [
  { key: 'burger', emoji: '🍔', label: 'ハンバーガー', order: 1 },
  { key: 'ramen', emoji: '🍜', label: 'ラーメン', order: 2 },
  { key: 'pizza', emoji: '🍕', label: 'ピザ', order: 3 },
  { key: 'sushi', emoji: '🍣', label: '寿司', order: 4 },
  { key: 'curry', emoji: '🍛', label: 'カレー', order: 5 },
  { key: 'cafe', emoji: '☕', label: 'カフェ', order: 6 },
  { key: 'other', emoji: '🍽️', label: 'その他', order: 99 },
];

/** 'other'（フォールバック先）の定義。ICON_DEFS と整合させる。 */
const FALLBACK_ICON_DEF: IconDef = ICON_DEFS.find(
  (def) => def.key === 'other'
)!;

/**
 * IconKey から IconDef を解決する。
 * 万一未知のキーが渡されても 'other' にフォールバックして描画を継続する。
 */
export function getIconDef(key: IconKey): IconDef {
  return ICON_DEFS.find((def) => def.key === key) ?? FALLBACK_ICON_DEF;
}

/**
 * 任意の文字列が IconKey として有効かを判定する型ガード。
 * バリデーション（許可値チェック）に使う。
 */
export function isIconKey(value: string): value is IconKey {
  return ICON_DEFS.some((def) => def.key === value);
}

/**
 * IconKey の並び順（order）。未知キーは末尾相当（Number.MAX_SAFE_INTEGER）に倒す。
 * 一覧のカテゴリ順ソートに使う。
 */
export function getIconOrder(key: IconKey): number {
  return getIconDef(key).order;
}
