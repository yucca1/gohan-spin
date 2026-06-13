# 設計書

## アーキテクチャ概要

既存の「キー抽象化」設計をそのまま踏襲する。
`IconKey`（キー文字列の型）と `ICON_DEFS`（絵文字・ラベル・並び順の静的解決マップ）の
2か所にカテゴリを追加するだけで、型ガード・UI選択肢・絵文字解決・ソートが自動追従する。

```
IconKey (型: 許可キーの集合)
   └── ICON_DEFS (静的データ: emoji/label/order) ← Single Source of Truth
          ├── getIconDef() / getIconOrder() / isIconKey()  解決・検証
          ├── ShopListView  登録/編集フォームの<option>を動的生成
          └── RouletteView  扇形へ絵文字描画
```

## コンポーネント設計

### 1. `src/types/IconKey.ts`

**責務**:
- 許可するカテゴリキーのユニオン型を定義する。

**実装の要点**:
- ユニオン型に `'pasta'` と `'gohanmono'` を追加する。
- 型は実行時データから自動生成できないため、ここだけは `ICON_DEFS` と二重管理になる（設計上の意図）。

### 2. `src/icons/iconDefs.ts`

**責務**:
- 各 `IconKey` を絵文字・ラベル・並び順に解決する静的マップ `ICON_DEFS` を提供する。

**実装の要点**:
- 2エントリを追加する。
  - `{ key: 'pasta', emoji: '🍝', label: 'パスタ', order: 4 }`
  - `{ key: 'gohanmono', emoji: '🍚', label: '丼物', order: 7 }`
- `order` は昇順を維持する必要がある（テストで検証されている）。
- 意味的グルーピングのため、パスタはピザの隣、丼物はカレーの隣に挿入し、後続の `order` を繰り下げる。

#### order の新旧対応

| key     | 旧order | 新order | 備考 |
|---------|--------|--------|------|
| burger  | 1      | 1      | 据え置き |
| ramen   | 2      | 2      | 据え置き |
| pizza   | 3      | 3      | 据え置き |
| pasta   | -      | 4      | 新規（ピザの隣・洋食/麺） |
| sushi   | 4      | 5      | 繰り下げ |
| curry   | 5      | 6      | 繰り下げ |
| gohanmono | -      | 7      | 新規（カレーの隣・ご飯もの） |
| cafe    | 6      | 8      | 繰り下げ |
| other   | 99     | 99     | 据え置き（フォールバック） |

### 3. `src/views/ShopListView.ts`（変更なし）

- `<option>` は `ICON_DEFS` をループして動的生成しているため、コード変更は不要。
- 追加した2カテゴリが自動的に選択肢に出る。

## データフロー

### カテゴリ選択 → 保存 → 表示
```
1. ユーザーが登録/編集フォームで「🍚 丼物」を選択（option は ICON_DEFS から生成済み）
2. isIconKey() で許可値チェック（gohanmono/pasta も true）
3. Shop.iconKey に 'gohanmono' を保存
4. 一覧/ルーレットで getIconDef('gohanmono').emoji = '🍚' を描画
```

## エラーハンドリング戦略

- 新規追加のため新たなエラークラスは不要。
- 未知キーは従来どおり `getIconDef` が `other` にフォールバックする（防御的挙動は維持）。

## テスト戦略

### ユニットテスト（`tests/unit/icons/iconDefs.test.ts`）
- 既存テスト（order昇順 / emoji・label存在 / フォールバック / burger=1, other=99）はそのまま通ること。
- 追加テスト:
  - `getIconDef('gohanmono').emoji === '🍚'`
  - `getIconDef('pasta').emoji === '🍝'`
  - `isIconKey('gohanmono') === true` / `isIconKey('pasta') === true`

### 統合テスト
- 不要（既存のビュー結合テストが ICON_DEFS 由来の選択肢を網羅的に検証していれば自動追従）。

## 依存ライブラリ

- 追加なし。

## ディレクトリ構造

```
src/types/IconKey.ts        （変更: ユニオン型に2キー追加）
src/icons/iconDefs.ts       （変更: ICON_DEFS に2エントリ追加 + order繰り下げ）
tests/unit/icons/iconDefs.test.ts （変更: 新キーのテスト追加）
```

## 実装の順序

1. `IconKey.ts` のユニオン型に `pasta` / `gohanmono` を追加
2. `iconDefs.ts` の `ICON_DEFS` に2エントリ追加し order を繰り下げ
3. テストに新キーの検証を追加
4. テスト・型チェック・ビルドで品質確認

## セキュリティ考慮事項

- 機密情報の取り扱いなし。静的な絵文字・ラベル定数のみ。

## パフォーマンス考慮事項

- `ICON_DEFS` は数件の配列。`find` による線形探索の影響は無視できる。

## 将来の拡張性

- SVGアイコン化（P1）の際は `IconDef` の解決先を差し替えるだけで、本変更のキーはそのまま使える。
