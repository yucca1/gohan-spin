/**
 * アイコン（カテゴリ）のキー文字列。
 *
 * 表示用の絵文字やラベルは持たず、キーだけを保持する。
 * これにより将来「絵文字 → SVG アイコンセット」へ差し替える際、
 * データ（Shop.iconKey）には手を入れず icons/ の解決マップだけ変更すればよい。
 */
export type IconKey =
  | 'burger'
  | 'noodle'
  | 'pizza'
  | 'pasta'
  | 'sushi'
  | 'curry'
  | 'gohanmono'
  | 'cafe'
  | 'other';

/**
 * IconKey の表示・並び順を解決するための静的定義。
 * （永続化されず、icons/iconDefs.ts に定義する静的データ）
 */
export interface IconDef {
  key: IconKey;
  /** 表示用の絵文字（MVP）。例: '🍔' */
  emoji: string;
  /** カテゴリ表示名。例: 'ハンバーガー' */
  label: string;
  /** カテゴリ順ソートの並び順（昇順） */
  order: number;
}
