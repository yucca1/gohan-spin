# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: 型・定義の変更

- [x] `src/types/IconKey.ts` の `'ramen'` を `'noodle'` に変更（※先行着手済み）
- [x] `src/icons/iconDefs.ts` の定義を変更
  - [x] `key: 'ramen'` → `key: 'noodle'`
  - [x] `label: 'ラーメン'` → `label: '麺類'`
  - [x] `emoji: '🍜'`, `order: 2` は維持

## フェーズ2: テスト更新

- [x] 既存テストの `'ramen'` 参照を `'noodle'` に更新
  - [x] `tests/unit/icons/iconDefs.test.ts`
  - [x] `tests/unit/views/RouletteView.test.ts`
  - [x] `tests/unit/views/ShopListView.test.ts`
  - [x] `tests/unit/services/ShopService.test.ts`（変数名・コメントも noodle に統一）
  - [x] `tests/integration/shop-management.test.ts`

## フェーズ3: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（156 passed）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`（dist 再生成済み）

## フェーズ4: ドキュメント更新

- [x] `docs/` 内に `ramen`/`ラーメン` カテゴリ前提の記述があれば更新（functional-design / glossary 等）
  - glossary.md（IconKey定義・型例・カテゴリ名）/ functional-design.md（IconKey型・カテゴリ一覧）を更新
  - PRD・ideas・UIモックの「ラーメン」は例示・履歴・店名例のため意図的に据え置き
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-13

### 計画と実績の差分

**計画と異なった点**:
- 当初はマイグレーション（旧 `'ramen'` データの自動変換）込みで計画したが、利用者がゆっか1人・データ少量のため YAGNI と判断し、マイグレーション一式を削除。`ShopRepository.ts` と `ShopStoreSchema.ts` は無変更で済んだ。
- 旧データは「🍽️ その他」にフォールバックさせ、手動で付け替える運用とした（アプリは壊れない）。

**新たに必要になったタスク**:
- テストの変数名・コメント（`const ramen` → `const noodle`）も整合のため変更（キー値だけでなく識別子も統一）。

### 学んだこと

**技術的な学び**:
- 「キー（`IconKey`）」と「表示（`label`/`emoji`）」が分離された設計のおかげで、変更が `iconDefs.ts` の1行＋型定義に閉じた。関心の分離の効果を実感。
- 日本語店名「ラーメン」と英字キー `ramen` は文字体系が違うため、`ramen` トークン置換が店名に影響しないことを利用して安全に一括置換できた。
- ドキュメントは機械的全置換ではなく、「仕様定義」と「例示・履歴」を切り分けて更新範囲を絞るのが適切。

**プロセス上の改善点**:
- 過剰設計（マイグレーション）を計画段階でユーザー確認により削れた。YAGNI判断は早い段階で行うほど無駄が減る。

### 次回への改善提案
- 永続化キーのリネームは「互換性を担保するか」を最初に確認する。利用規模（単独利用か配布か）で判断が大きく変わる。
