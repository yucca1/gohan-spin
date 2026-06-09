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

## フェーズ1: ShopListView の振る舞いユニットテスト作成

- [x] `tests/unit/views/ShopListView.test.ts` を作成（共通の beforeEach セットアップ）
  - [x] root と handlers（vi.fn）を用意し bindEvents で注入する beforeEach
- [x] 構築のテスト
  - [x] コンストラクタで form と `.shop-list` が root 配下に描画される
- [x] 登録(submit)のテスト
  - [x] フォーム送信で `onCreate` が `{name, iconKey}` で呼ばれる
  - [x] 不正な iconKey は `'other'` にフォールバックする
- [x] 対象切替(change)のテスト
  - [x] toggle 変更で `onToggle(id, checked)` が呼ばれる
- [x] 編集開始(click)のテスト
  - [x] edit-btn クリックで該当行が編集行（`.is-editing` / `.edit-name`）になる
- [x] 保存(click)のテスト
  - [x] 編集行で値変更 → save-btn で `onEdit(id, {name, iconKey})` が呼ばれる
- [x] キャンセル(click)のテスト
  - [x] cancel-btn で編集モード解除、通常行に戻る
- [x] 削除(click)のテスト
  - [x] confirm=true で `onDelete(id)` が呼ばれる
  - [x] confirm=false で `onDelete` が呼ばれない
- [x] render の出し分けのテスト
  - [x] `enabled:false` の行に `is-disabled` が付く
  - [x] 渡したお店の数だけ行が描画される（計画外で追加）
  - [x] 店名は textContent で反映され HTML パースされない（XSS無害化・計画外で追加）
- [x] エラー表示系のテスト
  - [x] `showValidationError` で `.form-error` にメッセージ + `has-error` 付与
  - [x] `clearError` で解除される
  - [x] `resetForm` で入力がクリアされる

## フェーズ2: カバレッジ設定の見直し

- [x] `vitest.config.ts` の `coverage.exclude` から `'**/views/**'` とコメントを削除
- [x] `thresholds` に view 用 glob 別閾値（60%）を追加
- [x] `npm run test:coverage` で実測し、閾値を実測に合わせて微調整（view実測: Branch65%/Lines96%。60%で無理なくクリア）

## フェーズ3: ドキュメント更新

- [x] `docs/development-guidelines.md` 225行のテスト方針文言を新方針へ更新
- [x] 「重点テスト項目」に View の項目を追記
- [x] テストピラミッド図のユニット層に View を含める旨を補足（任意）

## フェーズ4: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（72件パス）
- [x] カバレッジ閾値を満たすことを確認
  - [x] `npm run test:coverage`（全体80% / view 60% ともにクリア）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`（エラーなし）
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`（エラーなし）

## フェーズ5: 振り返り

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-09

### 計画と実績の差分

**計画と異なった点**:
- 作業途中で Claude Code がハルシネーションし、成果物（テストコード・vit.config の除外削除）は実在するのに tasklist の進捗が未更新のまま中断していた。再開時はまず「実装と実際のテスト実行」で成果物の健全性を検証してから tasklist を実態に最新化した。
- フェーズ1のテストは計画項目より厚く、計画外で「描画行数の検証」「店名 textContent の XSS 無害化検証」の2ケースが追加されていた（合計15ケース）。
- 計画にあった「`editingId` 一致行のみ編集行になる（render 出し分け）」専用ケースは独立テストとしては存在せず、「編集開始（click）」のテストで実質的にカバーされていた。

**新たに必要になったタスク**:
- ハルシネーション復旧のための「成果物の実態検証（テスト実行による整合性確認）」と「tasklist 最新化」。
- implementation-validator による妥当性評価で2件の指摘に対応:
  1. [推奨] vitest.config.ts のコメントが Vitest の glob 別閾値の挙動を誤説明していた（「グローバルから除外」は Jest の挙動で誤り）→ 公式ドキュメントで裏取りし、コメントと本振り返りを訂正。
  2. [提案] design.md が検証を明記していた `showEditError`（＋`finishEditing`）のテストが欠けていた → 2ケース追加。ドキュメントと実装の整合を回復。view の Branch 65%→70%、Funcs 88%→100%、Lines 96%→99.37% に向上。テスト件数 72→74。

### 学んだこと

**技術的な学び**:
- Vitest の glob 別 `thresholds`（例: `'src/views/**': { branches: 60, ... }`）は、対象ファイルに「追加の個別下限」を課す仕組み。Vitest の仕様として対象ファイルはグローバル閾値の計算にも引き続き含まれる（Jest とは異なる挙動。公式ドキュメント coverage.thresholds[glob-pattern] の NOTE で確認）。当初「グローバルから除外される」と誤認していたが、実装検証で発覚し公式ドキュメントで訂正した。今回 view を含めても全体 branch が 81.81% で 80% を満たすため、設定は意図どおり機能している。
- view の実測は Branch 65% / Lines 96% で、未カバーは main から呼ばれる連携用メソッド（`showEditError`/`finishEditing`）と一部ガード節。60%閾値が現実的なラインだった。
- jsdom 上では実 DOM API（`dispatchEvent` / `click` / `value` 設定）と `vi.spyOn(window, 'confirm')` だけで view の振る舞いを安定して検証でき、専用ヘルパは不要だった。

**プロセス上の改善点**:
- 進捗を tasklist にリアルタイム反映していれば、中断時の復旧コスト（実態調査）が下がる。タスク着手・完了の都度こまめに更新する原則を徹底する。
- 復旧時は「ドキュメントの記述」ではなく「コードを実際に動かした結果」を一次情報として信頼する。

### 次回への改善提案
- 同じパターンで将来の `RouletteView` のテストも書ける。view 追加時は glob 別閾値の枠組みをそのまま活用する。
- 長時間タスクでは、フェーズ完了ごとに tasklist の最終確認を挟み、進捗とドキュメントの乖離を早期に検知する。
