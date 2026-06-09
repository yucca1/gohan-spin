# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: エラークラスとサービス層（ロジック）

- [x] `NotFoundError` を `src/errors.ts` に追加
  - [x] `id` フィールドを保持し `this.name = 'NotFoundError'` を設定
  - [x] デフォルトメッセージ「お店が見つかりません」を扱えるようにする
- [x] `ShopService` のバリデーションを共通化（create/update 兼用）
  - [x] 店名検証ヘルパ（trim後1〜50文字）を private に切り出す
  - [x] アイコン検証ヘルパ（許可値チェック）を private に切り出す
  - [x] 既存 `create` / `validate` をヘルパ利用へリファクタ（挙動は不変）
- [x] `ShopService.update(id, input)` を実装
  - [x] id 不一致で `NotFoundError`
  - [x] 渡されたフィールドのみ検証・部分マージ（name は trim 保存）
  - [x] `updatedAt` 更新・`id`/`createdAt` 不変・全件保存・更新後 Shop を返す
- [x] `ShopService.toggleEnabled(id, enabled)` を実装（update へ委譲）
- [x] `ShopService.remove(id)` を実装（id 不在で `NotFoundError`・全件保存）
- [x] `ShopService.listEnabled()` を実装（enabled=true のみ・カテゴリ順）
- [x] 予約コメント（「後続で追加」等）を実態に合わせて更新

## フェーズ2: ロジック層のテスト

- [x] `tests/unit/services/ShopService.test.ts` に `update` のテストを追加
  - [x] 店名のみ/アイコンのみ/enabledのみの部分更新
  - [x] trim 保存・updatedAt 更新・createdAt 不変
  - [x] name 境界（0/1/50/51文字）・不正 iconKey で ValidationError
  - [x] 存在しない id で NotFoundError
- [x] `toggleEnabled` のテストを追加（true⇄false・updatedAt 更新・NotFound）
- [x] `remove` のテストを追加（件数減・永続化・NotFound）
- [x] `listEnabled` のテストを追加（enabled のみ・カテゴリ順・全 disabled で空）
- [x] `tests/integration/shop-management.test.ts` を新規作成
  - [x] 編集 → 再読込で内容/updatedAt が一致
  - [x] 対象切替 → 再読込で enabled 保持
  - [x] 削除 → 再読込で復活しない

## フェーズ3: UI層（View / main / CSS）

- [x] `ShopListHandlers` に `onToggle` / `onEdit` / `onDelete` を追加
- [x] `ShopListView` にインスタンス状態（`handlers` / `editingId` / `shops`）を追加
- [x] `buildRow` を拡張（対象チェックボックス・編集/削除ボタン・data-id）
- [x] `buildEditRow`（編集行: 店名input・アイコンselect・保存/キャンセル・行内エラー）を実装
- [x] `render` を編集モード対応に変更（editingId の行は編集行を描画・shops 保持）
- [x] `bindEvents` をデリゲーション方式に拡張（click / change で操作を振り分け）
  - [x] 削除は `window.confirm` で確認
- [x] `finishEditing()` / `showEditError(message)` メソッドを追加
- [x] `main.ts` に `onToggle` / `onEdit` / `onDelete` を結線
  - [x] エラー出し分け（編集の ValidationError は行内・他は共通欄・想定外は再throw）
- [x] `src/styles/main.css` にスタイル追加（チェックボックス・操作ボタン44px・編集行）

## フェーズ4: 品質チェックと修正

- [x] `npm test` がすべて通る（55 件パス）
- [x] `npm run lint` がエラーなし
- [x] `npm run typecheck` がエラーなし
- [x] `npm run build` が成功する（カバレッジはロジック層 100%）

## フェーズ5: ドキュメント更新・振り返り

- [x] requirements.md / PRD の受け入れ条件のうち達成項目をチェック
- [x] 永続ドキュメント（docs/）への影響を確認し、必要なら更新（errors 系3ドキュメントに NotFoundError 追記）
- [x] 実装後の振り返り（このファイル下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-09

### 計画と実績の差分

**計画と異なった点**:
- 大枠は計画通り。新規ファイルは統合テスト1件のみで、他は既存ファイルへの追記に収まった（前フェーズの「予約コメント」設計が効いた）。
- `errors.ts` の `NotFoundError` 追加に伴い、当初スコープ外だった永続ドキュメント3件（development-guidelines / glossary / repository-structure）の追記が発生した。新しいエラークラスはユビキタス言語の一部のため整合させるのが妥当と判断。

**新たに必要になったタスク**:
- `ShopListView.clearError()` の追加と、main の各成功パスでの呼び出し（implementation-validator が検出した「成功操作後もエラー表示が残留する」UXバグの修正）。
- テスト2件追加: `toggleEnabled` の `updatedAt` 更新検証（要件トレーサビリティ）、`enabled=false` 状態での名前更新が enabled を巻き戻さない検証。

**技術的理由でスキップしたタスク**（該当する場合のみ）:
- なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- 条件付きスプレッド `...(input.x !== undefined && { x })` で部分更新を表現する際、`enabled: false`（falsy）を `undefined` と取り違えない設計が重要。テストで明示的に固定した。
- イベントデリゲーション（親に1リスナ＋`closest`/`data-id`）は、行が動的に増減するリストでリスナ管理を単純化する。`change`（チェックボックス）と `click`（ボタン群）の2本に集約できた。
- 「状態をセットする処理」には必ず「クリアする処理」を対で用意する。`showValidationError` に対する `clearError` の欠落が残留バグの原因だった。

**プロセス上の改善点**:
- 前フェーズの予約コメント（`UpdateShopInput` / 「後続で追加」）が設計の道標になり、調査コストを大きく削減できた。次フェーズへの予約コメントを残す価値が再確認できた。
- implementation-validator の指摘は実害（残留エラー表示）を含み、自動テストだけでは拾えないUX観点を補完できた。

### 次回への改善提案
- ルーレット機能の実装時は、今回確定した `listEnabled()` を供給口として使う（`RouletteEngine.build(enabledShops)`）。
- View 層は依然テスト対象外のため、UI操作の回帰は手動確認に依存している。将来 jsdom ベースの View テストや E2E を導入する余地がある。
- 編集UIはインライン方式。お店が多い場合のスクロール追従や、Enter キーでの保存などのキーボード操作改善は Post-MVP の候補。
