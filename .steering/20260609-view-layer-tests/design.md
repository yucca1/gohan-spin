# 設計書

## アーキテクチャ概要

既存のレイヤー構成（UI → Service/Engine → Data）はそのまま。今回は新規プロダクトコードを
追加せず、テストコードとテスト方針ドキュメント・設定のみを変更する。

`ShopListView` は依存が `constructor(root: HTMLElement)` と `bindEvents(handlers)` のみで、
jsdom 環境（`vitest.config.ts` で設定済み）と `vi.fn()` モックだけでテストできる。
新しいテストヘルパは不要。

```
tests/unit/views/ShopListView.test.ts
        │ new ShopListView(document.createElement('div'))
        │ view.bindEvents({ onCreate, onToggle, onEdit, onDelete } = vi.fn())
        ▼
   DOM操作（dispatchEvent / click / value 設定）
        ▼
   ハンドラ呼び出し・DOM状態を expect で検証
```

## コンポーネント設計

### 1. ShopListView.test.ts（新規）

**責務**:
- View層の「振る舞い」を jsdom 上で検証する
- 既存の Given-When-Then スタイル（`ShopService.test.ts`）に揃える

**実装の要点**:
- `beforeEach` で root（`document.createElement('div')`）に `ShopListView` を生成し、
  `vi.fn()` の handlers を `bindEvents` で注入
- イベントは実際の DOM API で発火（`form.dispatchEvent(new Event('submit'))`、
  `button.click()`、`input.value = ...; dispatchEvent(new Event('change'))`）
- 削除確認は `vi.spyOn(window, 'confirm')` でモックし、true/false 両方を検証
- 検証は「ハンドラの呼び出し引数」と「DOMの状態（クラス・値・テキスト）」に限定。
  DOM構造そのものやCSSの見た目はテストしない

### 2. vitest.config.ts（変更）

**責務**:
- view を計測対象に戻しつつ、view 用の緩い閾値を設定する

**実装の要点**:
- `coverage.exclude` から `'**/views/**'` の行（およびコメント）を削除
- `thresholds` に glob 別閾値を追加（全体80%は維持、view は60%）

### 3. docs/development-guidelines.md（変更）

**責務**:
- テスト方針を「viewはテストしない」から「振る舞いは薄くテストする」へ更新

**実装の要点**:
- 225行の文言を更新
- 「重点テスト項目」に View の項目を追記

## データフロー

### 登録操作のテスト
```
1. nameInput.value / iconSelect.value を設定（Given）
2. form.dispatchEvent(new Event('submit'))（When）
3. expect(onCreate).toHaveBeenCalledWith({ name, iconKey })（Then）
```

### 削除操作のテスト
```
1. render で行を描画、window.confirm を spyOn でモック（Given）
2. delete-btn を click（When）
3. confirm=true → onDelete 呼び出し / confirm=false → 未呼び出し（Then）
```

## エラーハンドリング戦略

新規のエラークラスは追加しない。テスト内で `showValidationError` / `clearError` /
`showEditError` の DOM 反映（`.form-error` のテキスト、`has-error` クラス）を検証する。

## テスト戦略

### ユニットテスト
- `ShopListView`: 登録 / 切替 / 編集開始 / 保存 / キャンセル / 削除（confirm分岐）/
  render の出し分け / エラー表示系メソッド

### 統合テスト
- 今回は追加しない（既存の Service+Repository 統合テストで担保済み）

## 依存ライブラリ

新規追加なし。既存の Vitest（^4.1.8）+ jsdom（^29.1.1）+ `vi` モックを使用。

## ディレクトリ構造

```
tests/
└── unit/
    └── views/
        └── ShopListView.test.ts  ← 新規

docs/development-guidelines.md     ← テスト戦略を更新
vitest.config.ts                   ← views除外を撤回、view閾値を追加
```

## 実装の順序

1. `tests/unit/views/ShopListView.test.ts` を作成（テストファースト）
2. `vitest.config.ts` の除外撤回 + view閾値追加
3. `npm run test:coverage` で実測 → 閾値（60%）を実測に合わせ微調整
4. `docs/development-guidelines.md` のテスト戦略を更新
5. `npm test` / `npm run typecheck` / `npm run lint` で検証

## セキュリティ考慮事項

- テスト内でユーザー入力を扱う際も、本番同様 `textContent` 経由の反映を前提に検証する
  （`name` に HTML を入れても DOM がパースされないことを確認できると尚良い）

## パフォーマンス考慮事項

- 特になし。jsdom 上の軽量なユニットテストのため実行時間への影響は小さい

## 将来の拡張性

- 同じパターンで将来の `RouletteView` のテストも書ける
- glob 別閾値の仕組みにより、view ごとに無理のないカバレッジ目標を設定できる
