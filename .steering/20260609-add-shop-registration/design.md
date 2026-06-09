# 設計書

## アーキテクチャ概要

機能設計書のレイヤード構成（View → Service → Repository）の縦スライスを、お店の登録に必要な範囲だけ実装する。依存方向は常に上から下への一方向。

```
┌──────────────────────────────────────────────┐
│  UI層: ShopListView                            │ ← 追加フォーム描画・登録操作受付・一覧描画・エラー表示
├──────────────────────────────────────────────┤
│  Service層: ShopService                        │ ← create / list / バリデーション
├──────────────────────────────────────────────┤
│  Data層: ShopRepository                        │ ← localStorage I/O・JSON・破損フォールバック
└──────────────────────────────────────────────┘
        ↑ 全層が依存可: types / icons（静的データ）
                   ↓
              localStorage (key: gohan-spin:shops)
```

依存ルール（リポジトリ構造定義書準拠）:
- View → Service（OK）。View は Repository / localStorage を直接触らない。
- Service → Repository（OK）。Service は View / engine を知らない。
- 共有型は `src/types/`、アイコン静的データは `src/icons/` に置き、全層が依存してよい。

## コンポーネント設計

### 1. 型定義（src/types/）

**責務**: アプリ全体で共有するデータ形を定義（受動的なデータ形のみ）。

**実装の要点**:
- `IconKey.ts`: `IconKey` ユニオン型（7種）、`IconDef` インターフェース（key/emoji/label/order）。
- `Shop.ts`: `Shop`、`CreateShopInput`、`UpdateShopInput`。`UpdateShopInput` は今回未使用だが設計通り定義（後続機能で使用）。
- `ShopStoreSchema.ts`: `{ version: number; shops: Shop[] }`。`SCHEMA_VERSION` 定数もここに置く。
- `import type` で参照し、実行時依存に含めない。

### 2. エラークラス（src/errors.ts）

**責務**: `throw` される振る舞いを持つエラーを集約（型定義とは分離）。

**実装の要点**:
- `ValidationError extends Error`: `field` / `value` を持つ。入力検証失敗時に throw。
- `StorageError extends Error`: ES2022 の `Error` 標準 `cause` オプションを使う（独自フィールドは持たない）。localStorage 書き込み失敗時に throw。
- 各クラスで `this.name` を設定。

### 3. アイコン定義（src/icons/iconDefs.ts）

**責務**: `IconKey` → 絵文字・ラベル・ソート順 の静的解決マップ。将来 SVG 差し替えの単一変更点。

**実装の要点**:
- `ICON_DEFS: readonly IconDef[]`（order 昇順で定義）。
- `getIconDef(key: IconKey): IconDef`（見つからなければ 'other' にフォールバック）。
- `isIconKey(value: string): value is IconKey`（バリデーション用の型ガード）。
- `compareByIconOrder(a, b)` 相当のヘルパー（Service のソートで利用）。

### 4. ShopRepository（src/repositories/ShopRepository.ts）

**責務**: localStorage への読み書き、JSON シリアライズ、破損/容量超過のフォールバック。

**実装の要点**:
- `STORAGE_KEY = 'gohan-spin:shops'` をモジュール定数で保持（インスタンス状態は持たない＝テスト差し替えしやすい構造的型）。
- `loadAll(): Shop[]`: `getItem` → `JSON.parse`。null / 破損 / 形が不正なら `[]` を返す（`try/catch`、例外を投げない）。
- `saveAll(shops: Shop[]): void`: `{ version: SCHEMA_VERSION, shops }` を `JSON.stringify` して `setItem`。失敗時は `StorageError` を throw（`cause` に元エラー）。
- `exists(): boolean`: キーが存在するか。

### 5. ShopService（src/services/ShopService.ts）

**責務**: お店の `create` と `list`、入力バリデーション。

**実装の要点**:
- コンストラクタで `ShopRepository`（構造的に同じ型）を受け取る（DI）。テストは `InMemoryShopRepository` を注入。
- `create(input: CreateShopInput): Shop`:
  1. `validate(input)` で店名（trim後1〜50文字）と `iconKey`（許可値）を検証 → NG は `ValidationError`。
  2. 既存件数が `MAX_SHOPS`(=100) 以上なら `ValidationError`。
  3. `crypto.randomUUID()` で採番、`enabled = true`、`createdAt = updatedAt = new Date().toISOString()`。
  4. `repo.saveAll([...既存, 新規])` で保存し、生成した `Shop` を返す。
- `list(): Shop[]`: 全件をカテゴリ順（`IconDef.order` → `createdAt` 昇順）でソートして返す。
- 同期実装（localStorage は同期 API のため `Promise` 化しない）。
- 定数: `MAX_NAME_LENGTH = 50`、`MAX_SHOPS = 100`。

> update / toggleEnabled / remove / listEnabled は次の機能（一覧管理・ルーレット）で追加する。今回のスコープ外。

### 6. ShopListView（src/views/ShopListView.ts）

**責務**: 追加フォーム描画、登録操作受付、入力バリデーションの UI 反映、一覧描画（読み取り専用）。

**実装の要点**:
- `constructor(root: HTMLElement)` でマウント先を受け取り、フォーム＋一覧コンテナを構築。
- `bindEvents({ onCreate })`: フォーム submit を捕捉し、`onCreate({ name, iconKey })` を呼ぶ。
- `render(shops: Shop[])`: 一覧を `DocumentFragment` でまとめて描画（リフロー抑制）。店名は `textContent`、アイコンは `getIconDef().emoji`。
- `showValidationError(message: string)`: エラー表示要素に `textContent` でメッセージ、フォームに `.has-error` を付与。
- `clearForm()` / エラー解除: 登録成功時にフォームをリセットし `.has-error` を外す。
- アイコン選択 `<select>` の初期値は `other`（未選択状態を作らない）。

### 7. main.ts / index.html / styles

**実装の要点**:
- `index.html`: `#app` を持つ最小 HTML（Vite エントリ）。`<script type="module" src="/src/main.ts">`。
- `main.ts`: `ShopRepository` → `ShopService` → `ShopListView` を結線（依存注入）。`onCreate` で `service.create` → 成功時 `view.render(service.list())` とフォームクリア、`ValidationError` 時 `view.showValidationError`。
- `styles/main.css`: フォーム・一覧・`.has-error` の最小スタイル。タップターゲットに配慮（過度に作り込まない）。

## データフロー

### UC-1: お店の登録（機能設計書 UC-1 準拠）
```
1. ユーザーが店名入力・アイコン選択 → [登録]（submit）
2. ShopListView が onCreate({name, iconKey}) を発火
3. main.ts のハンドラが ShopService.create() を呼ぶ
4. ShopService が validate（NG なら ValidationError）
5. OK なら Shop 生成（UUID / enabled=true / 日時）→ ShopRepository.saveAll()
6. ShopRepository が localStorage へ JSON 保存
7. 成功 → main.ts が view.render(service.list()) + フォームクリア
8. 失敗（ValidationError）→ view.showValidationError(message)
```

### 起動時の一覧復元
```
1. main.ts 起動 → service.list()（内部で repo.loadAll()）
2. 破損/未存在なら [] で継続
3. view.render(shops) で初期一覧を描画
```

## エラーハンドリング戦略

### カスタムエラークラス（src/errors.ts）
- `ValidationError(message, field, value)`: 入力検証エラー。View が日本語メッセージを表示。
- `StorageError(message, { cause })`: localStorage 書き込み失敗。

### エラーハンドリングパターン
- 読み込み失敗（破損 JSON / null）: 例外を投げず `[]` で継続（クラッシュさせない）。
- 書き込み失敗: `StorageError` を throw → main.ts で捕捉し、`view.showValidationError("保存に失敗しました…")` で通知。
- エラーを握り潰さない（`catch` して握りつぶし `null` 返しはしない。読み込みフォールバックのみ意図的に `[]`）。

## テスト戦略

### ユニットテスト
- `tests/unit/icons/iconDefs.test.ts`: `getIconDef`（既知キー / 未知キーは other フォールバック）、`isIconKey`、order 昇順定義。
- `tests/unit/repositories/ShopRepository.test.ts`: 空時 `[]`、保存→読込ラウンドトリップ、破損 JSON で `[]`（例外なし）、`exists()`。
- `tests/unit/services/ShopService.test.ts`: create の enabled=true / id・日時設定、バリデーション境界（0 / 1 / 50 / 51文字・空白のみ）、不正 iconKey、`MAX_SHOPS` 上限、`list` のカテゴリ順ソート。

### 統合テスト
- `tests/integration/shop-persistence.test.ts`: 実 `ShopRepository`（jsdom の localStorage）+ `ShopService` で、create→別インスタンスで list が一致（永続化ラウンドトリップ）。破損 JSON 投入時に list が `[]` で継続。

### テスト補助
- `tests/helpers/InMemoryShopRepository.ts`: `loadAll/saveAll/exists` を持つインメモリ実装。Service の純粋ロジック検証に使用。

## 依存ライブラリ

新規追加なし（`canvas-confetti` は今回未使用、ルーレットで使う）。ブラウザ標準 API（localStorage / crypto.randomUUID / DOM）のみ。

## ディレクトリ構造

```
gohan-spin/
├── index.html                          # 新規（Vite エントリ）
├── src/
│   ├── main.ts                         # 新規（結線）
│   ├── errors.ts                       # 新規
│   ├── types/
│   │   ├── IconKey.ts                  # 新規
│   │   ├── Shop.ts                     # 新規
│   │   └── ShopStoreSchema.ts          # 新規
│   ├── icons/
│   │   └── iconDefs.ts                 # 新規
│   ├── repositories/
│   │   └── ShopRepository.ts           # 新規
│   ├── services/
│   │   └── ShopService.ts              # 新規
│   ├── views/
│   │   └── ShopListView.ts             # 新規
│   └── styles/
│       └── main.css                    # 新規
├── tests/
│   ├── unit/
│   │   ├── icons/iconDefs.test.ts      # 新規
│   │   ├── repositories/ShopRepository.test.ts  # 新規
│   │   └── services/ShopService.test.ts          # 新規
│   ├── integration/shop-persistence.test.ts      # 新規
│   └── helpers/InMemoryShopRepository.ts          # 新規
├── tsconfig.json                       # 変更（include に tests/**/* 追加）
└── vitest.config.ts                    # 変更（coverage.exclude に views/main 追加）
```

## 実装の順序

1. 型定義（types/）→ errors.ts → icons/iconDefs.ts（最下層から）
2. ShopRepository（データ層）
3. ShopService（サービス層）
4. テスト補助（InMemoryShopRepository）+ ロジック層テスト
5. ShopListView / styles / index.html / main.ts（UI 層・結線）
6. 設定変更（tsconfig include / vitest coverage exclude）
7. 品質チェック（test / lint / typecheck / build）

## セキュリティ考慮事項

- XSS: 店名は `textContent` で DOM 反映。`innerHTML` への生埋め込み禁止。
- 入力検証: 店名 trim後1〜50文字、`iconKey` は許可値のみを `ShopService` で検証。
- 機密情報を持たない（外部送信なし・localStorage のみ）。

## パフォーマンス考慮事項

- 一覧描画は `DocumentFragment` でまとめて挿入しリフローを抑える。
- 保存は操作単位の小さな JSON（数十KB 規模で問題なし）。

## 将来の拡張性

- `IconKey` 抽象化により、絵文字→SVG は `icons/` の解決先変更のみで対応。
- `ShopStoreSchema.version` により、Post-MVP の `Shop.url` 追加時にマイグレーション可能。
- `ShopService` は今回 create/list のみ。update/toggle/remove/listEnabled を同クラスに追加して一覧管理・ルーレットへ拡張する。
- `ShopRepository` をインメモリ/IndexedDB へ差し替えてもレイヤー分離で吸収できる。
