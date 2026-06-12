# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### 実装可能なタスクのみを計画
- 計画段階で「実装可能なタスク」のみをリストアップ
- 「将来やるかもしれないタスク」は含めない
- 「検討中のタスク」は含めない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

### タスクが大きすぎる場合
- タスクを小さなサブタスクに分割
- 分割したサブタスクをこのファイルに追加
- サブタスクを1つずつ完了させる

---

## フェーズ1: GitHub Pages向けビルド設定（Vite）

- [x] `vite.config.ts` を新規作成し `base: '/gohan-spin/'` を設定
- [x] ローカル検証
  - [x] `npm run build` が成功し、`dist/index.html` のアセットパスが `/gohan-spin/` 始まりであることを確認
  - [x] ~~`npm run preview` で base 適用済みサイトが表示されることを確認~~（実行環境の制約により代替検証: サンドボックスがポートlistenを許可せずEPERMでサーバー起動不可。base設定の正しさはdist/index.htmlのアセットパス検証で確認済み。表示確認はフェーズ5の公開URL実機確認で実施）
  - [x] `npm test` がすべて通ることを確認（vitest.config.ts と競合しないこと）→ 152件すべてパス

## フェーズ2: GitHub Actionsワークフロー作成

- [x] `.github/workflows/deploy.yml` を新規作成
  - [x] トリガー設定（main への push + workflow_dispatch）
  - [x] 権限設定（contents: read / pages: write / id-token: write）
  - [x] concurrency 設定（group: 'pages'）
  - [x] 品質チェックステップ（npm ci → lint → typecheck → test）
  - [x] ビルド＆デプロイステップ（build → configure-pages → upload-pages-artifact → deploy-pages）
- [x] YAML構文の妥当性を確認（js-yamlでパース成功）

## フェーズ3: 品質チェックとコミット

- [x] すべてのテストが通ることを確認
  - [x] `npm test` → 152件パス
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`
- [x] README.md に公開URLを追記
- [x] コミット前に機密ファイルが含まれていないことを確認（git log / diff の確認）→ 全履歴に機密パターンなし
- [x] 変更をコミット

## フェーズ4: GitHubリポジトリ作成と公開

- [x] gh CLI の認証状態を確認（`gh auth status`）※サンドボックス制約のためユッカさんのターミナルで実行
- [x] パブリックリポジトリ `gohan-spin` を作成し main を push（`gh repo create gohan-spin --public --source=. --push`）
- [x] Settings → Pages で Source を「GitHub Actions」に設定（ユッカさんへ手順を案内し、設定完了を確認）
- [x] ワークフローの実行結果を確認（初回pushの実行はPages設定前のため「Setup Pages」で失敗→想定内。Pages設定後に `gh workflow run deploy.yml` で再実行し成功。品質チェック4点もCI上で全パス）

## フェーズ5: 公開確認とドキュメント更新

- [x] 公開URL（https://yucca1.github.io/gohan-spin/）でアプリが表示されることを確認（タイトル・ヘッダーの配信をHTTP経由で確認）
- [x] 公開URL上で主要フローの動作確認（お店登録→一覧→対象切替→Start→Stop→当選演出）をユッカさんへ依頼（問題なしの確認を受領。push起点の自動デプロイ成功もAPI経由で確認）
- [x] `docs/architecture.md` の「vite.config.ts 未作成」注記を実態に合わせて更新
- [x] `docs/repository-structure.md` の構造図を実態（vite.config.ts / .github/ 追加）に合わせて更新
- [x] ドキュメント更新をコミット
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-12

### 計画と実績の差分

**計画と異なった点**:
- `npm run preview` によるローカル表示確認は、実行環境（サンドボックス）がポートのlistenを許可せず実施不可だった。`dist/index.html` のアセットパス検証＋公開URLでの実機確認で代替した
- gh CLIも同様にサンドボックスから実行できなかったため、リポジトリ作成・push・再実行はコマンドを案内してユッカさんのターミナルで実行する方式に変更した
- 初回ワークフロー実行は、Pages の Source 設定（GitHub Actions への切替）より先に push が走ったため「Setup Pages」ステップで失敗した（design.md の注記どおりの想定内事象）。設定後に `gh workflow run deploy.yml` で再実行し成功

**新たに必要になったタスク**:
- なし（計画したタスクの範囲内で完了）

**技術的理由でスキップしたタスク**:
- `npm run preview` での表示確認
  - スキップ理由: サンドボックスがポートlistenを許可せず `EPERM` でpreviewサーバーを起動できない（環境制約）
  - 代替実装: `dist/index.html` のアセットパスが `/gohan-spin/` 始まりであることの検証＋公開URLでの実機動作確認

### 学んだこと

**技術的な学び**:
- GitHub Pages の GitHub Actions 方式は、`permissions`（contents: read / pages: write / id-token: write）の最小権限指定だけで動き、PATやシークレット登録が一切不要
- ワークフローに品質チェック（lint / typecheck / test）を組み込むと「チェックが通らない限り公開されない」ゲートとして機能する。初回失敗時も品質チェックまでは全部通っており、ステップ分割のおかげで失敗箇所（Setup Pages）が一目で特定できた
- Pages の Source 設定前に push するとデプロイ系ステップが失敗する。`workflow_dispatch` を入れておいたことで push なしで再実行でき、リカバリーが簡単だった
- WebFetch のレスポンスはURL単位で15分キャッシュされるため、CIの実行状況をポーリングする際はクエリパラメータを変えてキャッシュを回避する必要があった

**プロセス上の改善点**:
- design.md の「実装の順序」に初回失敗の可能性を注記していたため、実際に失敗したときも慌てずユッカさんに「想定内」と案内できた
- サンドボックスで実行できない操作（gh CLI）はユッカさんのターミナル実行に切り替え、コマンドを1ステップずつ案内する方式がスムーズだった（学習効果も高い）

### 次回への改善提案
- 公開済みサイトの変更時は、push 前にローカルで `npm run build` の成果物を確認する習慣を続ける（壊れたデプロイの予防）
- リポジトリ作成など環境制約で実施者が変わるタスクは、計画段階から「ユッカさん実施」と明記しておくと役割分担がより明確になる
- カスタムドメイン化やPRプレビューなどの拡張は design.md の「将来の拡張性」を起点に検討できる
