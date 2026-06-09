# 設計書

## アーキテクチャ概要

前フェーズで作った縦スライス（View → Service → Repository）に、更新系の振る舞い（編集・削除・対象切替）を**水平展開**する。新規ファイルは `NotFoundError` の追加（既存 `src/errors.ts` への追記）のみで、ほとんどが既存ファイルへの追記。依存方向は前フェーズ同様、上から下への一方向を厳守する。

```
┌──────────────────────────────────────────────────────────────┐
│  UI層: ShopListView                                            │
│   - 既存: 追加フォーム / 一覧描画 / 登録エラー表示             │
│   + 追加: 行内の[対象チェック][編集][削除]、インライン編集UI   │
├──────────────────────────────────────────────────────────────┤
│  Service層: ShopService                                        │
│   - 既存: create / list / validate                            │
│   + 追加: update / toggleEnabled / remove / listEnabled        │
├──────────────────────────────────────────────────────────────┤
│  Data層: ShopRepository（変更なし。loadAll/saveAll を再利用）  │
└──────────────────────────────────────────────────────────────┘
        ↑ 全層が依存可: types / icons / errors（NotFoundError 追加）
                   ↓
              localStorage (key: gohan-spin:shops)
```

依存ルール（前フェーズ踏襲）:
- View → Service のみ。View は Repository / localStorage を直接触らない。
- Service → Repository のみ。Service は View を知らない。
- `update` / `toggleEnabled` / `remove` はいずれも「全件 load → 配列を加工 → 全件 save」の単純戦略（件数は最大100件のため全件書き換えで十分）。

## コンポーネント設計

### 1. エラークラス追加（src/errors.ts）

**責務**: 「存在しない id への操作」という入力検証とは別種の失敗を型で表す。

**実装の要点**:
- `NotFoundError extends Error` を追加。`id`（探索対象）を保持し、`this.name = 'NotFoundError'` を設定。
- メッセージは機能設計書 L554 に合わせ「お店が見つかりません」。
- `ValidationError`（入力起因）とは区別する。View 側は両方を「想定内エラー」として表示する。

### 2. ShopService（src/services/ShopService.ts）

**責務**: お店の更新・削除・対象切替・対象一覧の取得を追加する。

**追加メソッド（機能設計書 L167-176 準拠）**:
```typescript
update(id: string, input: UpdateShopInput): Shop;       // 部分更新・updatedAt更新
toggleEnabled(id: string, enabled: boolean): Shop;      // enabled のみ更新（update に委譲）
remove(id: string): void;                               // 削除
listEnabled(): Shop[];                                  // enabled=true のみ（list と同じソート）
```

**実装の要点**:
- `update`:
  - `loadAll()` で全件取得し、`id` 一致を探す。無ければ `NotFoundError` を throw。
  - 渡されたフィールドのみ検証（`validateUpdate`）。`name` が来たら trim後1〜50文字、`iconKey` が来たら許可値チェック。`enabled` は boolean のみ。
  - 既存 Shop に部分マージし、`name` は trim 保存、`updatedAt` を現在時刻に更新。`id` / `createdAt` は不変。
  - 全件を `saveAll`。更新後の Shop を返す。
- `toggleEnabled`: `update(id, { enabled })` に委譲し、薄いラッパとして実装（重複ロジックを避ける）。
- `remove`: `loadAll()` → `id` 一致を除外。除外前後で件数が変わらなければ（= 存在しない）`NotFoundError`。`saveAll`。
- `listEnabled`: `list()`（カテゴリ順ソート済み）を `enabled === true` でフィルタ。
- バリデーション共通化: 既存 `validate(input)`（create用）と整合させる。店名検証・アイコン検証を小さな private ヘルパに切り出し、create/update で重複させない。`MAX_NAME_LENGTH` 等の定数を再利用。

### 3. ShopListView（src/views/ShopListView.ts）

**責務**: 一覧の各行に操作（対象チェック・編集・削除）を追加し、インライン編集UIを提供する。

**ハンドラ拡張（機能設計書 L232 準拠）**:
```typescript
interface ShopListHandlers {
  onCreate: (input: CreateShopInput) => void;            // 既存
  onToggle: (id: string, enabled: boolean) => void;      // 追加
  onEdit: (id: string, input: UpdateShopInput) => void;  // 追加
  onDelete: (id: string) => void;                        // 追加
}
```

**実装の要点**:
- イベントは**デリゲーション**で扱う。行は動的に増減するため、行ごとに addEventListener せず、`listEl` に `click` / `change` を1つずつ登録し、`closest('.shop-row')` の `data-id` で対象を特定する。
  - `change` の `.toggle-checkbox` → `onToggle(id, checked)`
  - `click` の `.edit-btn` → 編集モードへ（`editingId = id` にして再描画）
  - `click` の `.delete-btn` → `window.confirm` で確認 → `onDelete(id)`
  - `click` の `.save-btn` → 編集行の入力値を読み `onEdit(id, { name, iconKey })`
  - `click` の `.cancel-btn` → 編集モード解除（`editingId = null` で再描画）
- View はインスタンス状態 `editingId: string | null` と、再描画用に直近の `shops: Shop[]` を保持する（編集モード切替時に外部から shops を貰わず自前で再描画するため）。
- 行の描画を2系統に分ける:
  - `buildRow(shop)`: 通常行。`[対象チェックボックス][アイコン][店名][✎編集][🗑削除]`。`data-id` を付与。店名は `textContent`（XSS対策）。
  - `buildEditRow(shop)`: 編集行。`[店名input][アイコンselect][保存][キャンセル][行内エラー]`。input の初期値は現在値。
- ハンドラは `bindEvents` で受け取り `this.handlers` に保持し、デリゲーションリスナから参照する。
- 編集成功/失敗の反映:
  - 成功時: main 側が `view.finishEditing()`（`editingId=null`）→ `view.render(service.list())`。
  - 失敗時（ValidationError）: main 側が `view.showEditError(message)` で編集行の行内エラーに表示。
- タップターゲット: チェックボックス・編集/削除ボタンは 44×44px 以上のヒット領域を確保（PRD 非機能要件）。

### 4. main.ts（src/main.ts）

**責務**: 追加したハンドラ（onToggle/onEdit/onDelete）を結線し、想定内エラー（ValidationError / NotFoundError / StorageError）を View へ表示する。

**実装の要点**:
- `view.bindEvents({ onCreate, onToggle, onEdit, onDelete })` に拡張。
- 各ハンドラで `service.xxx()` を呼び、成功時に `view.render(service.list())` で再描画。
- エラー処理:
  - `onEdit` の ValidationError は `view.showEditError(message)`（編集行内に表示）。
  - `onToggle` / `onDelete` / `onEdit` の NotFoundError / StorageError は共通のエラー表示（`view.showValidationError(message)`）。想定外エラーは再 throw（握り潰さない）。

## データフロー

### UC: ルーレット対象を切り替える
```
1. ユーザーが行のチェックボックスをクリック（change イベント）
2. View（デリゲーション）→ handlers.onToggle(id, checked)
3. main → service.toggleEnabled(id, checked) → update(id, {enabled}) → repo.saveAll
4. main → view.render(service.list()) で一覧再描画（is-disabled スタイル反映）
```

### UC: お店を編集する
```
1. ユーザーが行の[✎]をクリック → View が editingId=id にして再描画（編集行表示）
2. 店名/アイコンを変更し[保存]をクリック
3. View → handlers.onEdit(id, { name, iconKey })
4. main → service.update(id, input)
   - 成功 → view.finishEditing(); view.render(service.list())
   - ValidationError → view.showEditError(message)（編集行に留まる）
```

### UC: お店を削除する
```
1. ユーザーが行の[🗑]をクリック → window.confirm で確認
2. OK → handlers.onDelete(id)
3. main → service.remove(id) → repo.saveAll
4. main → view.render(service.list()) で一覧から消える
```

## エラーハンドリング戦略

### カスタムエラークラス
- 既存: `ValidationError`（入力検証）/ `StorageError`（保存失敗）。
- 追加: `NotFoundError`（id 不在）。メッセージ「お店が見つかりません」。

### エラーハンドリングパターン
- Service は想定内の失敗を専用エラーで throw（戻り値でエラーを表現しない）。
- main（境界）で `instanceof` 判定し、ValidationError / NotFoundError / StorageError のみ画面表示。それ以外は再 throw（バグの早期発見）。
- 編集の検証エラーは編集行内（`showEditError`）、その他は共通エラー欄（`showValidationError`）に出し分ける。

## テスト戦略

### ユニットテスト（ShopService）
- `update`: 店名のみ更新 / アイコンのみ更新 / enabled のみ更新（部分更新）、trim 保存、updatedAt 更新・createdAt 不変、name 境界（0/1/50/51文字）、不正 iconKey、存在しない id で NotFoundError。
- `toggleEnabled`: true→false / false→true、updatedAt 更新、存在しない id で NotFoundError。
- `remove`: 削除で件数が減る・永続化される、存在しない id で NotFoundError。
- `listEnabled`: enabled=true のみ返す・カテゴリ順、全件 disabled なら空配列。

### 統合テスト（ShopService + 実 ShopRepository）
- 編集 → 別インスタンスで再読込して updatedAt/内容が一致。
- 対象切替 → 再読込で enabled 状態が保持。
- 削除 → 再読込で復活しない。

### UI層
- 前フェーズ同様、`ShopListView` / `main.ts` はカバレッジ対象外（ロジック層に集中）。手動確認（`npm run dev`）で操作を検証する。

## 依存ライブラリ

新規追加なし（既存スタックのみで実装可能）。

## ディレクトリ構造

```
src/
  errors.ts              （変更: NotFoundError 追加）
  main.ts                （変更: onToggle/onEdit/onDelete 結線・エラー出し分け）
  services/
    ShopService.ts       （変更: update/toggleEnabled/remove/listEnabled 追加）
  views/
    ShopListView.ts      （変更: 行操作・インライン編集・デリゲーション）
  styles/
    main.css             （変更: チェックボックス・操作ボタン・編集行のスタイル）
tests/
  unit/services/
    ShopService.test.ts          （変更: update/toggle/remove/listEnabled のテスト追加）
  unit/errors.test.ts            （新規: NotFoundError の最小テスト・任意）
  integration/
    shop-management.test.ts      （新規: 編集・削除・切替のラウンドトリップ）
```

## 実装の順序

1. `NotFoundError` を `src/errors.ts` に追加。
2. `ShopService` に `update` / `toggleEnabled` / `remove` / `listEnabled` を追加（バリデーション共通化）。
3. Service のユニットテストを追加（TDD的に 2 と並走可）。
4. 統合テスト（編集・削除・切替のラウンドトリップ）を追加。
5. `ShopListView` に行操作・インライン編集・デリゲーションを実装。
6. `main.ts` の結線とエラー出し分けを実装。
7. `main.css` にスタイル追加。
8. `test` / `lint` / `typecheck` / `build` を通す。
9. 手動確認（`npm run dev`）。

## セキュリティ考慮事項

- 店名はユーザー入力。通常行・編集行ともに `textContent` / `input.value` で扱い、`innerHTML` への代入を避ける（XSS対策、前フェーズ踏襲）。
- 削除は不可逆操作のため `window.confirm` で確認を挟み、誤操作を防ぐ。

## パフォーマンス考慮事項

- 更新系は全件 load→save の単純戦略。最大100件のため `JSON.stringify` のコストは無視できる。
- 一覧再描画は `DocumentFragment` + `replaceChildren` でまとめて挿入（前フェーズ踏襲、リフロー抑制）。

## 将来の拡張性

- `update` の部分更新を土台に、Post-MVP の `Shop.url`（外部リンク）追加も `UpdateShopInput` にフィールドを足すだけで対応可能。
- `listEnabled` は後続のルーレット機能（`RouletteEngine.build(enabledShops)`）への供給口になる。今回その口を確定させる。
- 編集UIはインライン方式。将来モーダル化する場合も、View 内の `editingId` 状態管理を流用できる。
