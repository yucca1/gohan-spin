# 要求内容

## 概要

別プロジェクト（CLIベースのタスク管理ツール）から流用・コピーした未完成リポジトリ「gohan-spin」を、新アプリ開発を始められる状態まで整備する。

## 背景

- 現在のリポジトリは、流用元プロジェクトから不要ファイルを削除しただけの状態。
- `src/index.ts` は流用元（`task` CLI）の名残で、存在しないモジュールをimportしており動作しない。
- `package.json` がまだ無く、`npm` 系コマンドが一切動かない。
- skill群（architecture-design / functional-design 等）の例示が「タスク管理ツール」前提のままで、新アプリ「gohan-spin」向けに合っていない。
- 旧式の `.claude/commands/` が残っており、command は skill に統合されたため変換が必要。

これらを整備し、スペック駆動開発（`/setup-project` でのドキュメント作成）を開始できる土台を作る。

## 実装対象の機能

### 1. 初期要求のブレインストーミング（docs/ideas/initial-requirements.md）
- ユッカと壁打ちし、新アプリ「gohan-spin」が何をするものかを言語化する。
- `/setup-project` 実行時に読み込まれる下書きとして `docs/ideas/initial-requirements.md` を作成。

### 2. commands → skill 変換
- `.claude/commands/` 配下（add-feature, setup-project, review-docs）を skill 形式に変換する。
- 変換後、旧 `.claude/commands/` の扱い（削除 or 残置）を整理する。

### 3. package.json の作成
- `ref_package.json` を参考に、新アプリ向けの `package.json` を作成。
- アプリ内容・想定ライブラリを反映する（詳細はブレスト後に確定）。

### 4. skill群の新アプリ向け修正
- 特に `architecture-design` と `functional-design` の例示・前提を gohan-spin 向けに修正。
- その他 skill（prd-writing, repository-structure 等）も必要に応じて見直す。

### 5. ライブラリのインストール
- 確定した `package.json` をもとに `npm install` で依存をインストールする。

## 受け入れ条件

### 1. 初期要求のブレスト
- [ ] `docs/ideas/initial-requirements.md` が作成されている
- [ ] アプリの目的・主要機能・対象ユーザーが言語化されている
- [ ] ユッカの承認を得ている

### 2. commands → skill 変換
- [ ] `.claude/commands/` の各コマンドが skill 形式に変換されている
- [ ] 旧 commands ディレクトリの扱いが整理されている

### 3. package.json
- [ ] `package.json` が作成され、`name` / `bin` 等が新アプリ向けに設定されている
- [ ] `ref_package.json` のスクリプト・devDependencies を踏襲している

### 4. skill群の修正
- [ ] architecture-design / functional-design の例示が gohan-spin 向けに修正されている

### 5. ライブラリインストール
- [ ] `npm install` が成功し、`node_modules` が生成される
- [ ] `npm run typecheck` / `npm run lint` が実行可能な状態になる

## 成功指標

- 整備完了後、`/setup-project` を実行して永続ドキュメント作成フローに進める状態になっている。
- `npm` 系コマンド（test/lint/typecheck/build）が動作する。

## スコープ外

以下はこのフェーズでは実装しません:

- アプリ本体（gohan-spin）の機能実装そのもの
- 永続ドキュメント（PRD等）の正式作成（`/setup-project` で別途実施）
- CI/CD の構築

## 参照ドキュメント

- `ref_package.json` - 流用元の package.json（参考用）
- `CLAUDE.md` - プロジェクト方針
- ※ `docs/` 配下の永続ドキュメントは本作業で整備する土台が完成した後に作成する
