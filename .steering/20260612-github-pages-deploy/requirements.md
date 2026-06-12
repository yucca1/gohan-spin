# 要求内容

## 概要

gohan-spin を GitHub Pages で一般公開し、main ブランチへの push をトリガーに GitHub Actions で自動ビルド・自動デプロイされる仕組みを構築する。

## 背景

- アプリ本体（お店管理・ルーレット・効果音）はMVPとして動作する状態に達しており、ブラウザだけで動く静的サイトとして公開できる段階にある。
- `docs/architecture.md` では当初から「静的アセットをGitHub Pagesへ配信する」方針が定義されているが、配信の仕組みは未実装。
- 現状はローカルリポジトリのみで、**GitHubリモートリポジトリが未作成**。公開のためにはまずリポジトリのpushが必要。
- 手動デプロイは更新漏れ・手順ミスの温床になるため、GitHub Actionsによる自動化（CI/CD）を最初から導入する。

## 実装対象の機能

### 1. GitHubリポジトリの作成と接続

- GitHub上にパブリックリポジトリ `gohan-spin` を作成する
- ローカルリポジトリにリモート（origin）を設定し、mainブランチをpushする
- 機密ファイル（`.env`等）が含まれていないことをpush前に確認する

### 2. GitHub Pages向けビルド設定（Vite）

- `vite.config.ts` を新規作成し、`base: '/gohan-spin/'` を設定する
- ローカルの開発サーバー（`npm run dev`）とテストが引き続き正常に動作すること
- ユーザーは `https://<ユーザー名>.github.io/gohan-spin/` でアセット読み込みエラーなくアプリを利用できるようになる

### 3. GitHub Actionsによる自動デプロイワークフロー

- `.github/workflows/deploy.yml` を新規作成する
- mainブランチへのpushをトリガーに、以下を自動実行する:
  1. 依存インストール（`npm ci`）
  2. 品質チェック（lint / typecheck / test）
  3. ビルド（`npm run build`）
  4. `dist/` を GitHub Pages へデプロイ（公式アクション `actions/deploy-pages` 方式）
- 手動実行（`workflow_dispatch`）にも対応する
- ユーザーはpushするだけで常に最新版が公開されるようになる

### 4. リポジトリのPages設定と公開確認

- GitHubリポジトリの Settings → Pages で Source を「GitHub Actions」に設定する（ユッカさんによるWeb画面操作。手順を案内する）
- 公開URLで実際にアプリが動作することを確認する（ルーレット回転・お店登録・効果音）

## 受け入れ条件

### GitHubリポジトリの作成と接続

- [ ] GitHub上にパブリックリポジトリ `gohan-spin` が存在する
- [ ] `git remote -v` で origin が設定されている
- [ ] mainブランチがGitHubにpushされている
- [ ] 機密ファイルがコミット履歴に含まれていない

### GitHub Pages向けビルド設定（Vite）

- [ ] `vite.config.ts` に `base: '/gohan-spin/'` が設定されている
- [ ] `npm run build` が成功し、`dist/index.html` 内のアセットパスが `/gohan-spin/` 始まりになっている
- [ ] `npm run dev` でローカル開発が引き続き正常に動作する
- [ ] 既存テスト（`npm test`）がすべて通る

### GitHub Actionsによる自動デプロイワークフロー

- [ ] mainへのpushでワークフローが自動起動する
- [ ] lint / typecheck / test / build がワークフロー内で実行され、すべて成功する
- [ ] ワークフローが成功し、GitHub Pagesへのデプロイが完了する

### 公開確認

- [ ] `https://<ユーザー名>.github.io/gohan-spin/` でアプリが表示される
- [ ] お店の登録・一覧・ルーレット回転・当選演出が公開URL上で動作する

## 成功指標

- mainにpushしてから数分以内に最新版が公開URLに反映される（手作業ゼロ）
- 公開URLでの初期表示が `docs/architecture.md` の目標（FCP 1.5秒以内）を満たす

## スコープ外

以下はこのフェーズでは実装しません:

- カスタムドメインの設定（`*.github.io` のデフォルトURLで公開する）
- プルリクエスト時のプレビューデプロイ
- E2Eテストの自動化（Playwright導入は将来検討のまま）
- README.md の本格整備（公開URLの記載など最小限の更新は行う）

## 参照ドキュメント

- `docs/product-requirements.md` - プロダクト要求定義書
- `docs/architecture.md` - 技術仕様書（GitHub Pages配信方針・`base`設定の注記）
- `docs/repository-structure.md` - リポジトリ構造定義書（`vite.config.ts`追加方針）
