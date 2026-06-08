# 設計書

## アーキテクチャ概要

本作業は「開発環境の整備」というメタタスクであり、アプリのアーキテクチャ設計ではない。
そのため、永続ドキュメント（`docs/`）はまだ存在せず、本作業の完了後に `/setup-project` で作成する。

作業全体の流れ:

```
1. ブレスト（docs/ideas/initial-requirements.md 作成）  ← アプリの輪郭を確定
        │
        ▼
2. package.json 作成（ref_package.json 参考）          ← アプリ名・bin・依存を確定
        │
        ▼
3. npm install                                        ← 動く環境を作る
        │
        ▼
4. commands → skill 変換                               ← ハーネス整備
        │
        ▼
5. skill群の新アプリ向け修正                            ← ブレスト結果を反映
```

## 作業順序の設計判断

ユーザー指定: タスク1（ブレスト）が最初。以降は Claude が好ましい順で進行。

**採用する順序: 1 → 3 → 5(install) → 2 → 4**

理由:
- **3（package.json）と 5（install）を先**に行うことで「npmコマンドが動く環境」を早期に確立し、以降の検証（typecheck/lint）を回せるようにする。
- package.json の `name` / `bin` / 依存ライブラリはブレスト（1）でアプリ像が固まらないと決められないため、1の後に置く。
- **2（commands→skill変換）と 4（skill修正）は内容整備**であり、動く環境ができた後に落ち着いて行う。4はブレスト結果（アプリ像）に依存するため最後。

※ TODO番号と実行順は一致しない。tasklist.md ではフェーズ＝実行順で並べる。

## コンポーネント設計（作業単位）

### 1. docs/ideas/initial-requirements.md
**責務**:
- 新アプリ gohan-spin の目的・主要機能・対象ユーザー・制約を下書きとして記録
- `/setup-project` の入力となる

**実装の要点**:
- 構造化は最小限（CLAUDE.md の ideas ディレクトリ方針に従う）
- ユッカとの対話で内容を確定し、承認を得てから確定保存

### 2. package.json
**責務**:
- npm スクリプト、bin エントリ、依存定義

**実装の要点**:
- `ref_package.json` の scripts / devDependencies を踏襲
- `name`, `description`, `bin` のキー名はアプリ確定後に設定
- 想定ライブラリ（CLIフレームワーク等）はブレストで方向性が決まり次第追記

### 3. .claude/skills/（commands からの変換 + 内容修正）
**責務**:
- 旧 commands（add-feature / setup-project / review-docs）の skill 化
- architecture-design / functional-design 等の例示を gohan-spin 向けに修正

**実装の要点**:
- skill は `SKILL.md` の frontmatter（name / description）が必須
- 変換時は description を簡潔に保ち、トリガー条件を明示

## データフロー

### 環境整備の流れ
```
1. ブレスト内容を docs/ideas/initial-requirements.md に保存
2. その内容を踏まえ package.json を作成
3. npm install で依存解決
4. commands を skill に変換
5. skill 群の例示をアプリ向けに修正
```

## エラーハンドリング戦略

- `npm install` 失敗時はエラーログを確認し、依存バージョンの整合を取る。
- skill の frontmatter 不備は Claude Code がロードできないため、変換後に形式を確認する。

## テスト戦略

### 動作確認
- `npm install` の成功
- `npm run typecheck` / `npm run lint` がエラーなく起動できること（ダミーの example.* で確認）

## 依存ライブラリ

`ref_package.json` の devDependencies を踏襲（husky, eslint, vitest, tsup, tsx, typescript, typescript-eslint 等）。
アプリ本体の dependencies（CLIフレームワーク等）はブレスト後に確定。

```json
{
  "dependencies": {}
}
```

## ディレクトリ構造

```
gohan-spin/
├── docs/
│   └── ideas/
│       └── initial-requirements.md   ← 新規（タスク1）
├── package.json                       ← 新規（タスク3）
├── .claude/
│   ├── commands/                      ← skill 変換後に整理（タスク2）
│   └── skills/                        ← 内容修正（タスク4）
└── src/                               ← 流用元の名残（本作業ではアプリ実装しない）
```

## セキュリティ考慮事項

- `.env` 等の機密ファイルは作成・コミットしない。
- package.json にシークレットを含めない。

## パフォーマンス考慮事項

- 特になし（環境整備のため）。

## 将来の拡張性

- 本整備完了後、`/setup-project` → `/add-feature` のスペック駆動フローにスムーズに接続できることを重視。
- src/ の流用名残は、アプリ実装フェーズで作り直す前提（本作業では触らない）。
