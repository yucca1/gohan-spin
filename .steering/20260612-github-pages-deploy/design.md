# 設計書

## アーキテクチャ概要

GitHub Pages の「GitHub Actions方式」（公式推奨）を採用する。ビルド成果物をブランチにコミットする旧来の `gh-pages` ブランチ方式は使わず、ワークフロー内でビルドした `dist/` をアーティファクトとしてアップロードし、公式アクションで直接Pagesへデプロイする。

```
[ユッカさんのローカル]
   git push origin main
        │
        ▼
[GitHub Actions]  .github/workflows/deploy.yml
   ┌─────────────────────────────────────┐
   │ deploy ジョブ (ubuntu-latest)        │
   │  1. actions/checkout     コード取得  │
   │  2. actions/setup-node   Node 24    │
   │  3. npm ci               依存導入    │
   │  4. npm run lint         品質チェック│
   │  5. npm run typecheck                │
   │  6. npm test                         │
   │  7. npm run build        dist/ 生成  │
   │  8. configure-pages      Pages設定   │
   │  9. upload-pages-artifact dist/ 梱包 │
   │ 10. deploy-pages         Pages公開🚀 │
   └─────────────────────────────────────┘
        │
        ▼
[GitHub Pages]
   https://<ユーザー名>.github.io/gohan-spin/
```

- 品質チェック（4〜6）のいずれかが失敗するとワークフローはそこで停止し、**壊れた状態のアプリは公開されない**（CIとしてのゲート機能）。
- アプリ本体はサーバーレスSPAのまま変更なし。今回の変更は「配信の仕組み」のみで、レイヤードアーキテクチャには影響しない。

## コンポーネント設計

### 1. vite.config.ts（新規作成）

**責務**:
- GitHub Pagesのプロジェクトページ配信に必要な `base: '/gohan-spin/'` の設定

**実装の要点**:
- `defineConfig` を使った最小構成にする（既定値で動いているものを変えない）
- `base` を設定すると `npm run dev` のローカルURLも `http://localhost:5173/gohan-spin/` に変わる（挙動変化として動作確認に含める）
- テスト設定は既存の `vitest.config.ts` に分離済みのため、`vite.config.ts` にはテスト設定を書かない。両ファイルが共存する場合、Vitestは `vitest.config.ts` を優先するため競合しない

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gohan-spin/',
});
```

### 2. .github/workflows/deploy.yml（新規作成）

**責務**:
- mainブランチへのpush時（および手動実行時）に、品質チェック→ビルド→Pagesデプロイを自動実行する

**実装の要点**:
- **トリガー**: `push`（mainブランチ）+ `workflow_dispatch`（Actionsタブからの手動実行）
- **権限**: `GITHUB_TOKEN` に最小権限のみ付与（`contents: read` / `pages: write` / `id-token: write`）。シークレットの手動登録は不要
- **concurrency**: `group: 'pages'` を設定し、連続pushでデプロイが競合しないようにする（古い実行をキャンセルして最新のみ反映）
- **Node.jsバージョン**: `24`（devcontainer / `docs/architecture.md` の開発環境と一致させ、ローカルと同じ条件でビルドする）
- **npmキャッシュ**: `actions/setup-node` の `cache: 'npm'` で依存インストールを高速化
- **使用アクション**（いずれもGitHub公式・2026-06時点の最新メジャー）:
  - `actions/checkout@v6`
  - `actions/setup-node@v6`
  - `actions/configure-pages@v6`
  - `actions/upload-pages-artifact@v5`（`path: './dist'`）
  - `actions/deploy-pages@v4`
- **environment**: `github-pages` を指定し、デプロイ結果のURLがActions画面に表示されるようにする
- ジョブは単一（`deploy`）にする。ビルドとデプロイのジョブ分割は規模に対して過剰なため行わない

### 3. GitHubリポジトリ（新規作成・gh CLI使用）

**責務**:
- ソースコードのホスティングと、Actions/Pagesの実行基盤

**実装の要点**:
- `gh repo create gohan-spin --public --source=. --push` で作成とpushを一括実行（gh CLIの認証状態を事前確認）
- **パブリックリポジトリ**にする（GitHub PagesはFreeプランではパブリックのみ。Actionsも無料で使い放題になる）
- push前に機密ファイル（`.env`等）がコミット履歴に含まれていないことを確認する

### 4. リポジトリのPages設定（ユッカさんのWeb画面操作）

**責務**:
- デプロイ元を「GitHub Actions」に切り替える

**実装の要点**:
- Settings → Pages → Build and deployment → Source を「GitHub Actions」に設定
- この操作はWeb画面で行うのが確実（手順を実装時に案内する）。`gh api` での自動化も可能だが、初回は画面で仕組みを理解しながら操作する方が学習効果が高い

## データフロー

### デプロイ（mainへのpush時）
```
1. ユッカさんが main に push（またはActionsタブから手動実行）
2. GitHub Actions が deploy.yml を検知してUbuntu仮想マシンを起動
3. checkout でコードを取得し、setup-node で Node.js 24 を準備
4. npm ci → lint → typecheck → test を実行（失敗したらここで停止＝公開されない）
5. npm run build で dist/ を生成（base='/gohan-spin/' でパス解決）
6. upload-pages-artifact が dist/ を tar 形式で梱包しアップロード
7. deploy-pages がアーティファクトを GitHub Pages に展開
8. https://<ユーザー名>.github.io/gohan-spin/ に最新版が反映される
```

## エラーハンドリング戦略

### カスタムエラークラス

不要（アプリコードの変更はないため）。

### エラーハンドリングパターン

- **品質チェック失敗時**: ワークフローが失敗ステータスになり、デプロイは実行されない。Actionsタブのログで失敗ステップを特定して修正→再push
- **デプロイ失敗時**: 前回の公開内容が維持される（Pagesは新デプロイ成功まで旧版を配信し続けるため、サイトが消えることはない）
- **アセット読み込みエラー（真っ白画面）**: `base` 設定漏れ・誤りが典型原因。`dist/index.html` 内のパスが `/gohan-spin/` 始まりかをローカルで事前検証する

## テスト戦略

### ユニットテスト
- 新規テストコードは不要（アプリロジックの変更がないため）
- 既存テストがワークフロー内で毎回実行されることが今回の品質担保

### 統合テスト
- ローカル検証: `npm run build` 後に `npm run preview` で `base` 適用済みのサイトを確認
- 公開後検証: 公開URLで手動チェックリスト（お店登録→一覧→対象切替→Start→Stop→当選演出→効果音）を実施

## 依存ライブラリ

新規追加なし。`vite.config.ts` は既存の `vite` を参照するのみ。

## ディレクトリ構造

```
gohan-spin/
├── .github/                  # 新規
│   └── workflows/
│       └── deploy.yml        # 新規: 自動デプロイワークフロー
├── vite.config.ts            # 新規: base設定
└── README.md                 # 更新: 公開URLを追記
```

## 実装の順序

1. `vite.config.ts` 作成 → ローカルで build / preview / test / dev を検証
2. `.github/workflows/deploy.yml` 作成（YAML構文チェック）
3. README.md に公開URLを追記
4. ここまでをコミット
5. gh CLI で GitHubリポジトリ作成 & push
6. Settings → Pages で Source を「GitHub Actions」に設定（ユッカさん操作を案内）
7. ワークフロー実行を確認（失敗時はログを見て修正）
8. 公開URLで動作確認
9. `docs/architecture.md` / `docs/repository-structure.md` の「vite.config.ts未作成」注記を実態に合わせて更新

> 注: Sourceを「GitHub Actions」へ切り替える前にpushするとワークフローの初回実行が失敗することがあるが、設定後に手動再実行（またはRe-run）すればよい。

## セキュリティ考慮事項

- `GITHUB_TOKEN` は最小権限（`contents: read` / `pages: write` / `id-token: write`）のみ付与。Personal Access Tokenの発行やシークレット登録は一切行わない
- push前にコミット履歴へ機密ファイル（`.env` / `*.key` 等）が含まれていないことを確認する
- パブリックリポジトリになるため、コード・コミットメッセージ・`.steering/` ドキュメントもすべて公開される前提で内容を確認する

## パフォーマンス考慮事項

- `actions/setup-node` の npmキャッシュで2回目以降のワークフローを高速化
- `concurrency` 設定で無駄な並行デプロイを抑止
- GitHub PagesはCDN配信・HTTPS既定のため、FCP 1.5秒以内の目標（architecture.md）達成に有利

## 将来の拡張性

- **カスタムドメイン**: 将来導入する場合は `base: '/'` への変更とDNS設定のみ（ワークフローはそのまま使える）
- **PRプレビュー**: トリガーに `pull_request` を追加し、プレビュー用デプロイ先を分ける拡張が可能
- **E2E自動化**: Playwright導入時はワークフローの品質チェック群に `npm run test:e2e` を追加するだけで組み込める
