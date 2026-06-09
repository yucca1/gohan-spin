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

## フェーズ1: 型・エラー・アイコン定義（最下層）

- [x] `src/types/IconKey.ts` を作成（`IconKey` ユニオン型7種、`IconDef` インターフェース）
- [x] `src/types/Shop.ts` を作成（`Shop` / `CreateShopInput` / `UpdateShopInput`）
- [x] `src/types/ShopStoreSchema.ts` を作成（`ShopStoreSchema` / `SCHEMA_VERSION`）
- [x] `src/errors.ts` を作成（`ValidationError` / `StorageError`）
- [x] `src/icons/iconDefs.ts` を作成（`ICON_DEFS` / `getIconDef` / `isIconKey` / ソート用ヘルパー）

## フェーズ2: データ層（ShopRepository）

- [x] `src/repositories/ShopRepository.ts` を作成
  - [x] `loadAll()`（破損/未存在は `[]` で継続）
  - [x] `saveAll()`（`StorageError` で失敗通知）
  - [x] `exists()`

## フェーズ3: サービス層（ShopService）

- [x] `src/services/ShopService.ts` を作成
  - [x] バリデーション（店名 trim後1〜50文字 / `iconKey` 許可値 / `MAX_SHOPS` 上限）
  - [x] `create()`（UUID採番・enabled=true・日時設定・保存）
  - [x] `list()`（カテゴリ順 → createdAt 昇順ソート）

## フェーズ4: ロジック層テスト

- [x] `tests/helpers/InMemoryShopRepository.ts` を作成
- [x] `tests/unit/icons/iconDefs.test.ts` を作成
- [x] `tests/unit/repositories/ShopRepository.test.ts` を作成
- [x] `tests/unit/services/ShopService.test.ts` を作成
- [x] `tests/integration/shop-persistence.test.ts` を作成

## フェーズ5: UI層と結線

- [x] `src/views/ShopListView.ts` を作成（フォーム・一覧描画・エラー表示。`textContent` で XSS 対策）
- [x] `src/styles/main.css` を作成（フォーム・一覧・`.has-error` の最小スタイル）
- [x] `index.html` を作成（`#app` + module script）
- [x] `src/main.ts` を作成（Repository → Service → View 結線、create/エラーハンドリング）
- [x] `src/vite-env.d.ts` を作成（CSS import の型解決。typecheck 通過に必要）

## フェーズ6: 設定調整

- [x] `tsconfig.json` の `include` に `tests/**/*` を追加（テストの型チェック有効化）
- [x] `vitest.config.ts` の `coverage.exclude` に `src/main.ts` / `src/views/**` / `*.d.ts` / `tests/**` を追加（UI層はカバレッジ対象外＝ガイドライン準拠）

## フェーズ7: 品質チェックと修正

- [x] テストが通ることを確認（`npm test` → 30件パス）
- [x] リントエラーがないことを確認（`npm run lint` → エラーなし）
- [x] 型エラーがないことを確認（`npm run typecheck` → エラーなし）
- [x] ビルドが成功することを確認（`npm run build` → dist 出力成功）
- [x] カバレッジ閾値（ロジック層80%）を確認（`npm run test:coverage` → Stmts98% / Branch95% / Func100% / Lines100%）

## フェーズ8: 検証とドキュメント

- [x] `implementation-validator` サブエージェントで品質検証（総合5.0/5・[必須]指摘ゼロ）
- [x] 永続ドキュメントへの影響を確認（アーキテクチャ変更なし。UC-1シーケンス図を「バリデーションをShopServiceに一元化」へ更新済み＝ユッカ承認済み）
- [x] 実装後の振り返りを記録（このファイル下部）

---

## 実装後の振り返り

### 実装完了日
2026-06-09

### 計画と実績の差分

**計画と異なった点**:
- `src/vite-env.d.ts` を追加（計画外）。`main.ts` で CSS を import するため、`tsc --noEmit` が `.css` モジュールを解決できずエラーになる。Vite の `vite/client` 型を参照する宣言ファイルが必要だった。
- `vitest.config.ts` の coverage 除外に、計画の `views/main` に加えて `**/*.d.ts` と `tests/**` も追加。アンビエント宣言とテストコード自体はカバレッジ計測対象として不適切なため。
- テスト初回実行で `localStorage.setItem` のインスタンス代入モックが効かず1件失敗。jsdom は localStorage が Proxy 実装のため、`vi.spyOn(Storage.prototype, 'setItem')` でプロトタイプを差し替える方式に修正。

**新たに必要になったタスク（検証後の推奨反映）**:
- `ShopListView` の `iconKey` を型キャストから `isIconKey` 型ガードへ変更（View レイヤーの型安全性向上）。
- `'null'` JSON ケースと `ValidationError` の field/value 検証のテストを追加 → 全カバレッジ指標 100% を達成。
- 公開メソッドへの `@param` TSDoc 補完（ガイドライン準拠）。

**技術的理由でスキップしたタスク**: なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- レイヤード構成の「縦スライス」を最下層（types/icons）→ Data → Service → UI の順で積むと、各段で型エラーに迷わず実装できる。
- DI を「構造的型付け」で実現すると、テスト用 `InMemoryShopRepository` を interface 実装なしで注入できる（ShopRepository がインスタンス状態を持たない設計が前提）。
- 「読みは寛容（破損でも空配列で継続）・書きは厳格（StorageError を throw）」というエラーハンドリングの非対称設計が、信頼性要件（クラッシュさせない）と握り潰し禁止を両立する。
- `tsc`（型チェック）と Vite（バンドル）の責務の違い。CSS import は Vite が解決するが `tsc` には `vite/client` のアンビエント型が必要。

**プロセス上の改善点**:
- tasklist.md を1タスクごとにリアルタイム更新することで、無停止ループでも進捗が明確に追える。
- フェーズ4完了時点で一度テストを走らせたことで、localStorage モックの問題を早期に発見・修正できた（最終段まで持ち越さない）。

### 次回への改善提案

- **[ドキュメント・要承認]** `docs/functional-design.md` の UC-1 シーケンス図は「View で入力バリデーション」だが、実装はバリデーションを `ShopService` に一元化した（重複排除・単一責務の観点で実装が優位）。次回ドキュメント更新時に、シーケンス図を「View→Service: create()、Service でバリデーション」に更新することをユッカに提案する。
- **[次フェーズ]** `main.ts` で `create()` の戻り値を使わず `list()` を再取得している（localStorage 読み込みが create+list で2回）。現スケールでは無問題だが、後続の `update`/`remove` 実装前に「保存系メソッドの戻り値の扱い方針」を統一しておくとよい。
- **[次フェーズ]** 本機能はスコープを「登録＋読み取り専用一覧」に絞った。次は PRD 機能②「一覧の編集・削除・対象切替」を、本機能で作った `ShopService`（update/toggleEnabled/remove/listEnabled を追加）と `ShopListView`（行に操作 UI 追加）の拡張として実装する。
- **[UX・次フェーズ]** エラー表示後、ユーザーが入力を直し始めた時点（input イベント）で `has-error` をリアルタイム解除すると体験が向上する。
