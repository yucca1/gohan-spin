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

## 実行順メモ

ユーザー指定でフェーズ1（ブレスト）が最初。以降は依存関係を考慮し
「環境を動かす（package.json→install）」を先に、「内容整備（skill変換→修正）」を後にする。
（TODO番号と実行順は一致しない。詳細は design.md 参照）

実行順: 1 → 3 → 5(install) → 2 → 4

---

## フェーズ1: 初期要求のブレスト（TODO 1）

- [x] `docs/ideas/` ディレクトリを作成
- [x] ユッカとブレスト（アプリの目的・主要機能・対象ユーザー・制約を対話で確定）
  - [x] ユッカからアイデアをヒアリング
  - [x] 不明点を質問し、内容を具体化（演出スタイル=円形ホイール / アイコン=絵文字→将来SVG / 当選演出=リーチ+紙吹雪+点滅ズーム）
- [x] `docs/ideas/initial-requirements.md` を作成
- [x] ユッカの承認を得る（2026-06-08 承認。4点の修正反映済み: 当選表示にアイコン+店名併記/追加開発項目は今期実施で優先度一段下/localStorage採用確定/ルーレットはランダム配置）

## フェーズ2: package.json の作成（TODO 3）

- [x] `ref_package.json` の内容を再確認（CLI用＝bin構成。Webアプリ用に作り替えが必要と判断）
- [x] ブレスト結果をもとに `name` / `description` / `bin` を決定（name=gohan-spin、binは削除、private:true付与）
- [x] 想定ライブラリ（dependencies）の方針を確定（実行時依存=canvas-confetti、他はdev。npm registryで最新版を確認）
- [x] `package.json` を作成（vite/vitest系scriptに変更、jsdom等を追加。devDeps踏襲）

## フェーズ3: ライブラリのインストール（TODO 5）

> 📌 メモ: Claude実行環境では npm install の許可が下りなかったため、**ユッカが自分のターミナルで実行**することに決定（2026-06-08）。Claudeは他フェーズ（2・4）を先に進め、install完了後に検証へ戻る。

- [x] `npm install` を実行（ユッカが担当・実施済み）
- [x] `node_modules` が生成されたことを確認（@eslint/js 含めインストール確認済み）
- [x] 流用元の名残（src/index.ts/example.ts/example.test.ts）の対処方針を決定 → **削除のみ**（ユッカ判断）。削除実施済み。src/.gitkeep で空ディレクトリを維持
- [x] npm install 成功（222パッケージ、脆弱性0、husky prepare実行済み）
- [x] 流用元の設定ファイル群もCLI向けだったため修正（開発環境整備の一環）
  - [x] eslint.config.js が依存する `@eslint/js` を devDependencies に追加（^10.0.1）→ 反映に再 install 必要
  - [x] tsconfig.json をブラウザSPA向けに修正（lib に DOM/DOM.Iterable 追加、module ESNext、moduleResolution Bundler、noEmit、outDir/rootDir除去）
  - [x] vitest.config.ts の environment を node → jsdom に変更
  - [x] tsup.config.ts を削除（tsup未使用の死んだ設定）
- [x] 再 install 後に `npm run lint` が通ることを確認（EXIT=0、エラーなし）
- [x] `npm run typecheck` 起動確認 → ツールは正常動作。src/が空のため「No inputs」表示（想定どおり。アプリ実装でエントリ追加後に解消）

## フェーズ4: commands → skill 変換（TODO 2）

- [x] `.claude/commands/` の各ファイルを確認（add-feature / setup-project / review-docs）
- [x] 各 command を skill 形式（SKILL.md + frontmatter）に変換
  - [x] add-feature（`.claude/skills/add-feature/SKILL.md`、name+description付与・トリガー明記）
  - [x] setup-project（`.claude/skills/setup-project/SKILL.md`、「このコマンド」→「このスキル」に修正）
  - [x] review-docs（`.claude/skills/review-docs/SKILL.md`）
- [x] 旧 `.claude/commands/` の削除（ユッカが手動で `rm -rf .claude/commands` 実施・確認済み）
  - [x] `.claude/skills/.permtest`（権限テストの残骸）も削除済み
- [x] ~~settings.json の allow に `Skill(add-feature)` 等を追記~~（ユッカ判断により不要: 「Skill(add-feature)は追加不要」と明言。必要になれば update-config スキルで対応可能）

## フェーズ5: skill群の新アプリ向け修正（TODO 4）

> 方針確定（2026-06-08）: **ブラウザSPA汎用**で書き換え（gohan-spin特化にしない／再利用性重視）。
> CLIタスク管理固有の作り込み例（Devtask/Commander.js/tasks.json/CLIレイヤー/優先度推定アルゴリズム/ターミナルUI/chmod）を、
> ブラウザSPA汎用（DOM・コンポーネント・localStorage・Vite・60fps描画）に差し替える。
> ※「task」「優先度P0/P1/P2」など一般語として妥当な箇所は残す。

### 最優先（ユッカ指定の2つ）
- [x] architecture-design/guide.md（技術選定例/レイヤー例/性能指標/セキュリティ/スケーラビリティ/依存管理をSPA汎用に差し替え）
- [x] functional-design/guide.md（システム図/データモデル/コンポーネント/アルゴリズム(優先度推定→ease-out)/シーケンス図/UI/ファイル構造/エラー表をSPA汎用化）
- [x] functional-design/template.md（システム図・シーケンス図のCLI→View、UI設計をワイヤーフレーム+状態クラスに）

### 主要skillも今回修正
- [x] prd-writing/SKILL.md（Devtask例/ペルソナ/CLIインターフェース/NFR/KPIをSPA汎用化）
- [x] prd-writing/template.md（ペルソナ/KPI/CLI→UI/NFR例をSPA汎用化）
- [x] repository-structure/guide.md（cli//commands/=CLIコマンド/TaskCLI → views//ItemView 等のSPA構造へ。.claude構造もskills中心に）
- [x] repository-structure/template.md（.claude構造をcommands→skills/hooksに更新）
- [x] glossary-creation/guide.md（CLI略語例→SPA、レイヤー図cli/→views/、索引CLI→SPA。「タスク」は用語集の汎用例として残置）
- [x] development-guidelines/template.md（commit例/E2E cli.run→Playwright DOM/jest.fn→vi.fn/DBクエリ→localStorage/.env手順削除）
- [x] development-guidelines/guides/implementation.md（DatabaseError→StorageError/process.env機密→フロントに鍵を持たない/jest.fn→vi.fn/SQLi→XSS）
- [x] development-guidelines/guides/process.md（commit例/coverage設定jest→vitest/build→vite/ビルド確認tsc→vite）

### 仕上げ
- [x] 全11ファイルを再grepし、CLIタスク管理固有の残存例がないか確認

## フェーズ6: 品質チェックと確認

- [x] `npm run typecheck` が起動する（ツール正常動作。src/空のため「No inputs」表示=想定どおり）
- [x] `npm run lint` が起動する（EXIT=0、エラーなし）
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-08

### 計画と実績の差分

**計画と異なった点**:
- **設定ファイル群の修正が追加で必要だった**: 当初TODOは「package.json作成」止まりだったが、流用元の `eslint.config.js` / `tsconfig.json` / `vitest.config.ts` / `tsup.config.ts` もCLI向けのまま残っており、ブラウザSPA向けに修正が必要だった（tsconfigのDOM lib追加、vitestのjsdom化、tsup削除、@eslint/js依存追加）。これは npm install 後の lint/typecheck 検証で初めて発覚した。
- **実行順を 1→3→5→2→4 に組み替えた**: TODO番号順ではなく、依存関係（package.json確定→install→内容整備）を優先。
- **skill修正は「ブラウザ汎用」方針を採用**: 当初「gohan-spin特化」も選択肢だったが、ユッカ判断で再利用性を優先。対象も2skill→主要6skill（11ファイル）に拡大。

**新たに必要になったタスク**:
- 設定ファイル4種のブラウザSPA向け修正（上記）。
- 流用元 src/ の削除（壊れたCLIコードがtypecheck阻害）。`.gitkeep` で空ディレクトリ維持。

**サンドボックス制約による分担**:
- `npm install` と `.claude/` 配下の削除（旧commands / .permtest）はサンドボックス保護で Claude が実行不可 → ユッカが手動実施。
- `.claude/skills/` への書き込みは Bash不可 / Write・Editツール可、という二重構造を発見。

### 学んだこと

**技術的な学び**:
- **ブラウザSPAのTypeScript設定の要点**: `lib` に `DOM`/`DOM.Iterable` が無いと `document`/`localStorage` の型が出ない。`moduleResolution` はバンドラ環境では `Bundler` が正解。
- **テスト環境の選択**: ブラウザDOMを扱うテストは vitest の `environment: 'jsdom'` が必要。example が `jest.fn()` のままだと vitest(`vi.fn()`)で動かない、という"お手本コードの正しさ"の重要性。
- **command と skill の違い**: skillは `<name>/SKILL.md` + frontmatter（name/description）。descriptionの"いつ使うか"がトリガー判断の唯一の手がかり。
- **アプリ構成が変わると脅威モデルも変わる**: CLI(chmod/env secret/SQLi)→ブラウザSPA(XSS/localStorageに鍵を置かない)。

**プロセス上の改善点**:
- ステアリングに「実行順メモ」と各ファイルの修正内容を逐次記録したことで、長時間・多ファイルの作業でも迷子にならなかった。
- grepで「CLI固有マーカー」を定義し、修正前後で残存チェックしたことで、抜け漏れを機械的に防げた。

### 次回への改善提案
- **環境整備タスクでは設定ファイル(eslint/tsconfig/vitest等)も最初に棚卸しする**: package.jsonだけでなく、流用元の全configがアプリ種別に合っているか初手で確認すると、後工程の検証での手戻りが減る。
- **`.claude/` 配下の操作はWrite/Editツールを使う**: Bashのファイル操作はサンドボックスで弾かれるため。
- 次の作業（`/setup-project`）では、本作業で整えた skill 群（ブラウザSPA汎用）がそのまま活きる。
