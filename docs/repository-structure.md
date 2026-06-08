# リポジトリ構造定義書 (Repository Structure Document)

> 作成日: 2026-06-08
> 入力: `docs/product-requirements.md` / `docs/functional-design.md` / `docs/architecture.md`
> 方針: 機能設計書のレイヤード構成（View / Service・Engine / Repository）をディレクトリ構造に反映する。

## プロジェクト構造

> **注意**: 以下は**目標とするディレクトリ構造**。現時点では実装が始まっておらず、`src/` 配下は `.gitkeep` のみ。サブディレクトリは実装フェーズで順次作成される。コメントに「※未作成」とある項目はまだ存在しない。

```
gohan-spin/
├── index.html              # SPAのエントリHTML（Viteのエントリポイント）※未作成
├── src/                    # ソースコード（現状 .gitkeep のみ）
│   ├── main.ts             # アプリ初期化・各レイヤーの組み立て（依存注入）
│   ├── types/              # 型定義（Shop / IconKey / スキーマ等）
│   ├── errors.ts           # カスタムエラークラス（ValidationError / StorageError）
│   ├── icons/              # アイコン定義（IconKey → 絵文字/ラベル/順序の解決マップ）
│   ├── views/              # UIレイヤー（DOM描画・操作受付・演出）
│   ├── services/           # サービスレイヤー（お店CRUD・対象管理・バリデーション）
│   ├── engine/             # ルーレットの計算ロジック（回転・減速・当選判定）
│   ├── repositories/       # データレイヤー（localStorage I/O）
│   └── styles/             # CSS（レスポンシブ・レイアウト・演出）
├── tests/                  # テストコード（src併置と併用可。下記参照）※現状 空
│   ├── unit/               # ユニットテスト
│   └── integration/        # 統合テスト
├── docs/                   # プロジェクトドキュメント（6つの永続ドキュメント）
│   └── ideas/              # 下書き・アイデアメモ
├── .steering/              # 作業単位のステアリングファイル（コミット対象。下記参照）
├── .claude/                # Claude Code設定（skills/hooks等）
├── dist/                   # ビルド成果物（gitignore対象。GitHub Pagesへ配信）※ビルド時生成
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc / .prettierignore
├── .gitignore
└── README.md               # ※未作成
# vite.config.ts は未作成（GitHub Pages配信時に新規追加し base: '/gohan-spin/' を設定）
```

> **テスト配置の方針**: `vitest.config.ts`の`include`は `src/**/*.{test,spec}.ts` と `tests/**/*.{test,spec}.ts` の両方を対象にしている。本プロジェクトでは原則 **`tests/` に集約**（本番コードとテストを分離しビルドから除外しやすい）。ただし小さなロジックのテストはsrc併置も許容する（設定上は両対応）。チーム内で揺れないよう、迷ったら`tests/`に置く。

> ⚠️ **テストコードの型チェック**: 現状の`tsconfig.json`の`include`は`src/**/*`のみで`tests/`を含まない。`tsc --noEmit`（`npm run typecheck` / `npm run build`の前段）ではテストコードの型エラーが検出されない。実装フェーズで`include`に`tests/**/*`を追加するか、`tests/tsconfig.json`（ルートを`extends`）を用意する（`architecture.md`テスト戦略の注記と同期）。

## ディレクトリ詳細

### src/ (ソースコードディレクトリ)

#### src/types/

**役割**: アプリ全体で共有する型定義を集約。

**配置ファイル**:
- `Shop.ts`: `Shop`インターフェース、`CreateShopInput` / `UpdateShopInput`。
- `IconKey.ts`: `IconKey`型、`IconDef`インターフェース。
- `ShopStoreSchema.ts`: localStorage保存スキーマ（`{version, shops}`）。

**命名規則**: PascalCase（型名と一致）。

**依存関係**:
- 依存可能: なし（最下層。他に依存しない純粋な型）。
- 依存禁止: views / services / engine / repositories（型は実装に依存してはならない）。

> ルーレット固有の型（`WheelSegment` / `RouletteState` / `AngleListener`）は、エンジン外から参照されない限り `src/engine/RouletteEngine.ts` 内に定義する。複数レイヤーから参照する必要が出たら `src/types/Roulette.ts` へ切り出す。

#### src/errors.ts

**役割**: アプリ全体で使うカスタムエラークラスを集約。「型定義（受動的なデータ形）」と「`throw`される振る舞いを持つエラークラス」は性質が異なるため、`types/`とは別ファイルにする。

**配置ファイル**:
- `errors.ts`: `ValidationError`（入力検証エラー）、`StorageError`（localStorage書き込み失敗）。いずれも`Error`を継承。

**命名規則**: ファイルはcamelCase（`errors.ts`）、クラスはPascalCase + `Error`接尾辞。

**依存関係**:
- 依存可能: なし（最下層。標準`Error`のみ）。
- 依存禁止: views / services / engine / repositories。

#### src/icons/

**役割**: `IconKey` → 表示用絵文字・カテゴリラベル・ソート順 の静的解決マップ。MVPは絵文字、将来SVGへ差し替える際の単一の変更点。

**配置ファイル**:
- `iconDefs.ts`: `IconDef[]`の定義と、`getIconDef(key)` / カテゴリ順ソート用ヘルパー。

**命名規則**: camelCase（データ定義ファイル）。

**依存関係**:
- 依存可能: types。
- 依存禁止: views / services / engine / repositories。

#### src/repositories/ (データレイヤー)

**役割**: localStorageへのお店データの永続化I/O、JSONシリアライズ、破損/容量超過のフォールバック。

**配置ファイル**:
- `ShopRepository.ts`: `loadAll()` / `saveAll()` / `exists()`。

**命名規則**: PascalCase + `Repository`接尾辞。

**依存関係**:
- 依存可能: types、ブラウザ`localStorage` API。
- 依存禁止: services / engine / views（下位レイヤーは上位を知らない）。

#### src/services/ (サービスレイヤー)

**役割**: お店のCRUD、対象(enabled)切替、バリデーション、カテゴリ順ソート。

**配置ファイル**:
- `ShopService.ts`: `list()` / `listEnabled()` / `create()` / `update()` / `toggleEnabled()` / `remove()`。
- `ShopValidator.ts`: 店名・iconKeyのバリデーション（責務が膨らめば分離）。

**命名規則**: PascalCase + 役割接尾辞（`Service` / `Validator`）。

**依存関係**:
- 依存可能: types、icons、repositories。
- 依存禁止: views / engine（UIや演出を知らない）。

#### src/engine/ (ルーレット計算ロジック)

**役割**: 対象店のホイール区画割当（ランダム配置）、回転・減速・リーチ・当選判定の純粋計算。

**配置ファイル**:
- `RouletteEngine.ts`: `build()` / `start()` / `stop()` / `getWinner()` / `reset()`。
- `easing.ts`: `easeOutQuint`等のイージング関数（純粋関数・単体テスト容易）。

**命名規則**: PascalCase（クラス）/ camelCase（関数集）。

**依存関係**:
- 依存可能: types、ブラウザ`requestAnimationFrame` / `performance` API。
- 依存禁止: views / repositories / services（永続化やDOMに非依存の純粋ロジック）。

#### src/views/ (UIレイヤー)

**役割**: DOM描画、操作受付、入力バリデーションのUI反映、状態のCSSクラス制御、当選演出。

**配置ファイル**:
- `ShopListView.ts`: 追加フォーム・一覧描画・編集/削除/対象切替の操作。
- `RouletteView.ts`: ホイール描画・Start/Stop制御・当選演出（点滅/ズーム/店名/紙吹雪）。

**命名規則**: PascalCase + `View`接尾辞。

**依存関係**:
- 依存可能: types、icons、services、engine、canvas-confetti。
- 依存禁止: repositories（localStorageを直接触らない。必ずService経由）。

#### src/styles/

**役割**: レイアウト（レスポンシブ：PC横並び/スマホ縦積み）、お店一覧、ホイール、当選演出のスタイル。

**配置ファイル**:
- `main.css`（または機能別に分割: `layout.css` / `wheel.css` / `winner.css`）。

**命名規則**: kebab-case。状態は`.is-*`クラス（`.is-disabled` / `.is-spinning` / `.is-blinking`等）で表現。

#### src/main.ts

**役割**: アプリのエントリ。各レイヤーをインスタンス化し依存を注入して結線する（`ShopRepository`→`ShopService`→`View`、`RouletteEngine`→`RouletteView`）。

### tests/ (テストディレクトリ)

#### tests/unit/

**役割**: ユニットテスト。`src/`と対応する構造で配置。

**構造**:
```
tests/unit/
├── services/
│   └── ShopService.test.ts
├── engine/
│   ├── RouletteEngine.test.ts
│   └── easing.test.ts
└── repositories/
    └── ShopRepository.test.ts
```

**命名規則**: `[対象].test.ts`（例: `ShopService.ts` → `ShopService.test.ts`）。

#### tests/integration/

**役割**: レイヤーをまたぐ統合テスト（jsdom環境）。

**構造**:
```
tests/integration/
└── shop-persistence.test.ts   # Service+Repositoryの永続化ラウンドトリップ・破損データ耐性
```

#### E2Eテスト

MVPは手動チェックリストで実施。将来Playwright導入時に`tests/e2e/`を新設する。

### docs/ (ドキュメントディレクトリ)

**配置ドキュメント**:
- `product-requirements.md` / `functional-design.md` / `architecture.md` / `repository-structure.md`（本書）/ `development-guidelines.md` / `glossary.md`
- `ideas/`: 下書き・アイデアメモ（`initial-requirements.md`等）。

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| 型定義 | src/types/ | PascalCase | `Shop.ts` |
| アイコン定義 | src/icons/ | camelCase | `iconDefs.ts` |
| Viewクラス | src/views/ | PascalCase + `View` | `RouletteView.ts` |
| Serviceクラス | src/services/ | PascalCase + `Service` | `ShopService.ts` |
| Engineクラス/関数 | src/engine/ | PascalCase / camelCase | `RouletteEngine.ts` / `easing.ts` |
| Repositoryクラス | src/repositories/ | PascalCase + `Repository` | `ShopRepository.ts` |
| スタイル | src/styles/ | kebab-case | `wheel.css` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | tests/unit/ | `[対象].test.ts` | `ShopService.test.ts` |
| 統合テスト | tests/integration/ | `[機能].test.ts` | `shop-persistence.test.ts` |
| E2Eテスト | tests/e2e/（将来） | `[シナリオ].test.ts` | `spin-flow.test.ts` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| ツール設定 | プロジェクトルート | `vite.config.ts` / `vitest.config.ts` / `eslint.config.js` 等 |
| TS設定 | プロジェクトルート | `tsconfig.json` |

## 命名規則

### ディレクトリ名
- レイヤーディレクトリ: 複数形・kebab-case（`views/` `services/` `repositories/`）。
- 例外: `engine/`（単一の計算エンジンを表すため単数）、`icons/`（アイコン群）。

### ファイル名
- クラスファイル: PascalCase + 役割接尾辞（`ShopService.ts`）。
- 関数/データファイル: camelCase（`easing.ts` `iconDefs.ts`）。
- 型ファイル: PascalCase（`Shop.ts`）。
- スタイル: kebab-case（`main.css`）。

### テストファイル名
- パターン: `[テスト対象].test.ts`。

## 依存関係のルール

### レイヤー間の依存

```
views (UI)
  ↓ (OK)  ※ services と engine を利用
services / engine
  ↓ (OK)  ※ services のみ repositories を利用。engine は永続化非依存
repositories (Data)
```

すべてのレイヤーは `types` / `icons`（静的データ）に依存してよい。

**禁止される依存**:
- repositories → services / views (❌)
- services → views (❌)
- engine → views / repositories (❌)
- views → repositories の直接利用 (❌ 必ずService経由)

### 循環依存の禁止

共有が必要な型は`src/types/`へ抽出し、実装同士の相互importを避ける。`import type`を活用して型のみの依存は実行時依存に含めない。

## スケーリング戦略

### 機能の追加（Post-MVP対応）
- **外部リンク(P1)**: `types/Shop.ts`に`url?`追加、`repositories`でスキーマ`version`マイグレーション、`views`に導線追加。レイヤーをまたぐが各責務内で完結。
- **SVGアイコン(P1)**: `src/icons/`の解決先のみ変更（`IconKey`抽象化の効果。他レイヤーは無改修）。
- **効果音(P1)**: `src/engine/`または新設`src/audio/`に`SoundPlayer`を追加し、`RouletteView`から呼び出す。

### ファイルサイズの管理
- 1ファイル300行以下を推奨。`ShopService`や`RouletteView`が膨らんだら責務分割（例: `RouletteView`から演出を`WinnerEffect.ts`へ抽出）。

## 特殊ディレクトリ

### .steering/
作業単位の計画ファイル。`[YYYYMMDD]-[task-name]/` に `requirements.md` / `design.md` / `tasklist.md` を置く。**コミット対象**（作業記録・履歴として保持。Prettierの整形対象からは除外）。

### .claude/
Claude Code設定（`skills/` 等）。

## 除外設定

### .gitignore（実態の要点）
- `node_modules/` / `dist/` / `build/` / `*.tsbuildinfo`
- `coverage/` / `.nyc_output/`
- `.env` / `.env.local` / `.env.*.local`（機密。`.env.example`は作る場合のみ別途許可）
- `*.log` / `logs/` / `.DS_Store` / `.vscode/` / `.idea/`
- `.claude/settings.local.json`
- **`.steering/` は gitignore 対象外**（作業記録・履歴としてコミットして残す方針）。

### .prettierignore / eslint ignores（実態）
- `.prettierignore`: `node_modules/` / `dist/` / `.claude/` / `.steering/` / `docs/` / `CLAUDE.md` / `*log.json` を整形対象外にする（ドキュメントやステアリングは整形しない）。
- eslint: `eslint.config.js`の`ignores`で `node_modules/**` / `dist/**` / `.steering/**` を除外済み。
