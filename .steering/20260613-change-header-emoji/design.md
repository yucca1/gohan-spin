# 設計書

## アーキテクチャ概要

`index.html` への静的なマークアップ変更のみで完結する。JavaScript（`src/`）やスタイル（`src/styles/main.css`）の変更は不要。

```
index.html
 ├─ <head> に <link rel="icon"> を追加 → favicon を🍚に
 └─ <header class="app-header"> の 🎡 → 🍚
```

## コンポーネント設計

### 1. ヘッダー（index.html の <header>）

**責務**:
- アプリのタイトル表示

**実装の要点**:
- `🎡 gohan-spin` の絵文字部分のみ `🍚` に置換する
- タイトル文字列やクラス名（`app-header`）は変更しない

### 2. favicon（index.html の <head>）

**責務**:
- ブラウザタブに表示されるアイコンを提供する

**実装の要点**:
- 画像ファイルを追加せず、SVGに絵文字を描いた data URI を使う
- 追加する要素（例）:
  ```html
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🍚</text></svg>" />
  ```
- data URI 内では属性値をシングルクォートで囲み、`href` 全体はダブルクォートで囲むことで、HTMLとしてエスケープ不要にする
- 絵文字の描画はOS/ブラウザのフォント依存（OSごとに見た目が異なる）だが、機能要件上は許容する

## データフロー

### ページ読み込み時
```
1. ブラウザが index.html を読み込む
2. <head> の <link rel="icon"> を解釈し、SVG絵文字をタブアイコンとして描画
3. <header> の「🍚 gohan-spin」を画面上部に表示
```

## エラーハンドリング戦略

- 静的マークアップ変更のため、実行時エラーハンドリングは不要。

## テスト戦略

### ユニットテスト
- 追加・変更なし（ヘッダー絵文字を参照する既存テストは存在しないことを確認済み）

### 統合テスト
- 追加・変更なし

### 手動確認
- `npm run dev` で起動し、ヘッダーが「🍚 gohan-spin」、タブアイコンが🍚であることを目視確認
- `npm run build` 後の `dist/index.html` にも変更が反映されることを確認

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
index.html  （変更のみ。新規ファイルなし）
```

## 実装の順序

1. `index.html` のヘッダー絵文字を 🎡 → 🍚 に変更
2. `index.html` の `<head>` に🍚のSVG favicon を追加
3. 開発サーバー／ビルドで表示確認、品質チェック（lint / typecheck / build / test）

## セキュリティ考慮事項

- data URI は静的な自前コンテンツのみで、外部リソースの読み込みやユーザー入力を含まないため、追加のリスクはない。

## パフォーマンス考慮事項

- インラインのSVG data URIは追加のHTTPリクエストを発生させないため、画像ファイル方式よりむしろ軽量。

## 将来の拡張性

- 将来 PWA 化やOGP対応で正式なアイコン画像（PNG / apple-touch-icon / manifest）が必要になった場合は、別タスクで `public/` 配下に画像を追加する。
