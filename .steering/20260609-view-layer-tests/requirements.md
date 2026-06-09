# 要求内容

## 概要

View層（`src/views/ShopListView.ts`）のテストが現状0件のため、UI操作の「振る舞い」に対する
ユニットテストを追加する。あわせて、テスト方針ドキュメント（`docs/development-guidelines.md`）と
カバレッジ設定（`vitest.config.ts`）を「viewはテストしない」から「viewの振る舞いは薄くテストする」へ
見直す。

## 背景

`docs/development-guidelines.md` の「UI層（views）はロジックが薄いため低めでも許容」という方針と、
`vitest.config.ts` で `**/views/**` をカバレッジ計測から除外している設定により、View層のテストが
1件も書かれていない。

しかし実際の `ShopListView` は単なる描画だけでなく、以下の「振る舞い（behavior）」を持つ:

- 編集モードの状態機械（`editingId` の出し入れと再描画）
- イベントデリゲーションによる操作分岐（edit / delete / save / cancel / toggle）
- 型ガードによる `iconKey` のフォールバック
- 削除前の `window.confirm` の分岐

これらはリグレッションが起きやすく、テストが無いと「viewを安心して変更できない」状態になる。
テストを安全網として整備し、ガイドラインの方針も実態に合わせて更新する。

## 実装対象の機能

### 1. ShopListView の振る舞いユニットテスト

- jsdom 上で `ShopListView` を生成し、ユーザー操作に対して正しいハンドラが正しい引数で
  呼ばれることを検証するテストを追加
- 編集モードの開始・キャンセル、削除時の確認ダイアログ分岐、render の行出し分け、
  エラー表示系メソッドを検証

### 2. テスト方針・カバレッジ設定の見直し

- `vitest.config.ts`: `**/views/**` を計測対象に戻し、view 用の緩い閾値（60%）を設定
- `docs/development-guidelines.md`: テスト戦略の文言を「振る舞いは薄くテストする」へ更新

## 受け入れ条件

### ShopListView の振る舞いユニットテスト

- [ ] フォーム送信で `onCreate` が入力値（`{name, iconKey}`）とともに呼ばれる
- [ ] 不正な iconKey は `'other'` にフォールバックして `onCreate` に渡る
- [ ] トグル変更で `onToggle(id, checked)` が呼ばれる
- [ ] edit-btn クリックで該当行が編集行（`.is-editing` / `.edit-name`）に切り替わる
- [ ] 編集行で save-btn を押すと `onEdit(id, {name, iconKey})` が呼ばれる
- [ ] cancel-btn で編集モードが解除され通常行に戻る
- [ ] 削除時、`window.confirm` が true なら `onDelete(id)`、false なら呼ばれない
- [ ] `render` で `enabled:false` の行に `is-disabled` が付く
- [ ] `showValidationError` / `clearError` / `resetForm` が期待どおり DOM を更新する

### テスト方針・カバレッジ設定の見直し

- [ ] `vitest.config.ts` から `**/views/**` の除外が外れ、view が計測対象になっている
- [ ] view 用の閾値（60%）が設定され、`npm run test:coverage` が成功する
- [ ] `docs/development-guidelines.md` のテスト戦略が新方針に更新されている

## 成功指標

- View層のユニットテストが追加され、`npm test` が全件パスする
- `npm run test:coverage` で view が計測され、全体80% / view 60% の閾値を満たす
- ドキュメントと設定（guidelines / vitest.config）の方針が一致している

## スコープ外

以下はこのフェーズでは実装しません:

- 見た目・レイアウト・CSSクラスの細部に対するテスト（脆くなるため）
- E2E（Playwright）テストの導入
- `RouletteView` 等、まだ存在しない他のviewのテスト

## 参照ドキュメント

- `docs/product-requirements.md` - プロダクト要求定義書
- `docs/functional-design.md` - 機能設計書
- `docs/architecture.md` - アーキテクチャ設計書
- `docs/development-guidelines.md` - 開発ガイドライン（今回更新対象）
