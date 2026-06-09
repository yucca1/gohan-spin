/**
 * アプリ全体で使うカスタムエラークラス。
 *
 * 「型定義（受動的なデータ形）」とは性質が異なる（throw される振る舞いを持つ）ため、
 * types/ とは分けてこのファイルに集約する。
 */

/**
 * 入力検証エラー。
 * 予期されるエラーとして throw し、View が日本語メッセージを表示する。
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * localStorage への書き込み失敗（容量超過など）を表すエラー。
 * target は ES2022 のため Error 標準の cause オプションを使う（独自フィールドは持たない）。
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}
