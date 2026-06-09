# 要求内容

## 概要

gohan-spin の P0機能「お店の一覧表示・管理」の管理操作（編集・削除・ルーレット対象切替）を実装する。前フェーズで実装済みの読み取り専用一覧に、各行の操作（対象チェック・編集・削除）を追加し、結果を localStorage に永続化する。

## 背景

- 前フェーズ（`20260609-add-shop-registration`）で、お店の登録と読み取り専用の一覧表示・永続化（View → Service → Repository の縦スライス）が完成している。
- ただし登録したお店を後から「編集・削除・対象ON/OFF」する手段がまだない。PRD 機能②（`docs/product-requirements.md` L69-81）の受け入れ条件のうち、管理操作が未達のまま。
- 既存コードには今回を見越した予約がある: `UpdateShopInput`（`src/types/Shop.ts`）、`ShopService` の「update / toggleEnabled / remove は後続で追加」コメント、`ShopListView` の「編集・削除・対象切替は後続機能で追加」コメント。今回はこの設計意図に沿って具現化する。
- 機能設計書（`docs/functional-design.md` L167-176）に `update` / `toggleEnabled` / `remove` / `listEnabled` のシグネチャ、L554 にエラーメッセージ「お店が見つかりません」が確定済み。

## 実装対象の機能

### 1. ルーレット対象の切替（Service: toggleEnabled / View: チェックボックス）
- 一覧の各行にルーレット対象チェックボックスを表示し、ON/OFF を切り替えられる。
- 切替結果（`enabled`）は即座に localStorage に永続化され、リロード後も保持される。
- チェックOFFのお店は「ルーレット対象一覧（`listEnabled`）」から除外される（ルーレット本体は後続フェーズだが、除外ロジックの土台を用意する）。

### 2. お店の編集（Service: update / View: インライン編集）
- 一覧の各行の編集導線から、店名・アイコン（カテゴリ）を編集できる。
- 編集時も登録時と同じバリデーション（店名 trim後1〜50文字、iconKey 許可値）を適用する。
- 編集成功で `updatedAt` が更新され、一覧が再描画・永続化される。
- 編集バリデーションエラーは理由を画面に表示し、保存を中断する。

### 3. お店の削除（Service: remove / View: 削除導線）
- 一覧の各行の削除導線から、お店を削除できる。
- 削除前に確認を挟み、誤操作を防ぐ。
- 削除後は一覧から消え、localStorage に永続化される（ルーレット対象からも消える）。

### 4. 存在しないお店への操作のエラー処理（NotFoundError）
- 更新・切替・削除の対象 `id` が存在しない場合（一覧の競合等）、`NotFoundError`（"お店が見つかりません"）を throw し、想定内エラーとして画面に表示する。

## 受け入れ条件

### ルーレット対象の切替
- [ ] 一覧の各行にルーレット対象チェックボックスがあり、ON/OFF を切り替えられる。
- [ ] チェック状態（`enabled`）がリロード後も保持される（永続化）。
- [ ] `listEnabled()` は `enabled = true` のお店のみをカテゴリ順で返す。
- [ ] `toggleEnabled` は対象の `updatedAt` を更新する。

### お店の編集
- [ ] 各行の編集導線から、店名・アイコンを編集して保存できる。
- [ ] 編集時、店名が trim後1〜50文字でない場合は保存できず、理由が表示される。
- [ ] 編集時、`iconKey` が許可値でない場合は保存できず、理由が表示される。
- [ ] 編集成功で `updatedAt` が更新され（`createdAt` は不変）、一覧が再描画される。
- [ ] `update` は渡されたフィールドのみを更新・検証する（部分更新）。

### お店の削除
- [ ] 各行の削除導線から、確認の上でお店を削除できる。
- [ ] 削除後は一覧から消え、リロード後も復活しない（永続化）。

### エラー・永続化
- [ ] 存在しない `id` への update / toggleEnabled / remove は `NotFoundError`（"お店が見つかりません"）を投げる。
- [ ] 編集・削除・切替の結果が、別インスタンスでの再読込で一致する（ラウンドトリップ）。

### 品質
- [ ] `npm test` / `npm run lint` / `npm run typecheck` / `npm run build` がすべてパスする。
- [ ] ロジック層（Service の update / toggleEnabled / remove / listEnabled）にユニット・統合テストがある。

## 成功指標

- 登録済みのお店を、説明なしで編集・削除・対象切替できる（PRD「直感的な主要操作」）。
- ロジック層のテストカバレッジが branches/functions/lines/statements 各80%以上を維持（UI層は除外）。
- 一覧再描画が体感遅延なく完了する（目安100ms以内、数十件規模）。

## スコープ外

以下はこのフェーズでは実装しません（後続フェーズで対応）:

- ルーレット本体（`RouletteEngine` / `RouletteView`）と当選演出。`listEnabled` のデータ供給までを今回の範囲とする。
- レスポンシブの作り込み（デスクトップ横並び / iPhone縦積みの最適化）。操作できる最小限の見た目に留める。
- お店管理エリアの折りたたみ（開閉）UI。
- 並び替えのドラッグ操作・カテゴリ以外のソート。
- 効果音・外部リンク・SVGアイコン化（Post-MVP）。

## 参照ドキュメント

- `docs/product-requirements.md` - 機能②「一覧表示・管理」受け入れ条件（L69-81）
- `docs/functional-design.md` - ShopService API（L167-176）/ ShopListView（L222-234）/ エラー（L554）
- `docs/architecture.md` - レイヤード構成 / 永続化戦略 / 入力検証
- `docs/repository-structure.md` - ディレクトリ・命名・依存ルール
- `docs/development-guidelines.md` - コーディング規約 / 同期処理方針 / テスト
- `.steering/20260609-add-shop-registration/` - 前フェーズの設計・実装パターン
