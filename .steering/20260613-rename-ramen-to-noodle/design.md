# 設計書

## アーキテクチャ概要

既存のレイヤー構造（types / icons / views ほか）を踏襲し、変更は最小限に閉じる。
カテゴリの「キー」と「表示」は分離されており（`IconKey` 型 ＝ 内部識別子、`IconDef.label/emoji` ＝ 表示）、
今回はキー（`ramen`→`noodle`）と表示（`ラーメン`→`麺類`）の両方を変更する。

**マイグレーションは行わない**（利用者1人・少量データのため YAGNI）。旧 `iconKey: 'ramen'` のデータは
`getIconDef` のフォールバックで「🍽️ その他」表示になり、アプリはクラッシュしない。ゆっかが手動で付け替える。

## コンポーネント設計

### 1. types/IconKey.ts

**責務**: カテゴリの内部キー（ユニオン型）の定義

**実装の要点**:
- `'ramen'` を `'noodle'` に置換するのみ

### 2. icons/iconDefs.ts

**責務**: IconKey → 絵文字・ラベル・並び順 の静的解決

**実装の要点**:
- `{ key: 'ramen', emoji: '🍜', label: 'ラーメン', order: 2 }` を
  `{ key: 'noodle', emoji: '🍜', label: '麺類', order: 2 }` に変更
- `emoji` と `order` は維持（並び順・見た目を変えない）

## 旧データの扱い（マイグレーションなし）

```
保存データ(localStorage)  iconKey: 'ramen'（旧）
   ▼ loadAll() … 変換せずそのまま返す
Shop[]（iconKey は文字列 'ramen' のまま）
   ▼ 表示時 getIconDef('ramen')
'ramen' は ICON_DEFS に無い → FALLBACK（'other' / 🍽️）で描画
   ▼
ゆっかが画面で該当店を編集し「麺類」を選び直す → iconKey: 'noodle' で保存
```

- `ShopRepository` / `ShopStoreSchema` は **変更しない**（`SCHEMA_VERSION` も 1 のまま）。

## テスト戦略

### ユニットテスト
- `iconDefs.test.ts`: `getIconDef('noodle')` が label '麺類' / emoji 🍜 を返す
- 既存テストの `'ramen'` 参照を `'noodle'` に更新

### 統合テスト
- `shop-management.test.ts`: 'ramen' を使用している箇所を 'noodle' に更新し、登録〜読み込みが通ることを確認

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
変更:
  src/types/IconKey.ts
  src/icons/iconDefs.ts
  tests/unit/icons/iconDefs.test.ts
  tests/unit/views/RouletteView.test.ts
  tests/unit/views/ShopListView.test.ts
  tests/unit/services/ShopService.test.ts
  tests/integration/shop-management.test.ts
```

## 実装の順序

1. 型・定義の変更（IconKey, iconDefs）
2. テスト更新（既存の 'ramen' → 'noodle'）
3. 品質チェック（test / lint / typecheck / build）
4. dist の再ビルド確認（GitHub Pages 配信物との整合）

## セキュリティ考慮事項

- 機密情報の取り扱いなし。

## パフォーマンス考慮事項

- 静的定義の文字列変更のみで影響なし。

## 将来の拡張性

- 麺類サブカテゴリが本当に必要になった場合のみ、別カテゴリ追加で対応する（現時点では noodle に統合）。
