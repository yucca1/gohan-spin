# 開発ガイドライン (Development Guidelines)

> 作成日: 2026-06-08
> 入力: `docs/architecture.md` / `docs/repository-structure.md`
> 位置づけ: 本プロジェクトの技術スタック（Vite + TypeScript / localStorage / レイヤード構成）に即したコーディング規約と開発プロセス。多くは既存設定（ESLint / Prettier / tsconfig / husky / vitest）で**自動強制済み**であり、本書はその明文化と運用方針を担う。

## コーディング規約

### 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| 変数 | camelCase、名詞 | `enabledShops`, `currentAngle` |
| 関数 | camelCase、動詞で始める | `listEnabled()`, `getWinner()` |
| Boolean | `is` / `has` / `should` / `can` で始める | `isSpinning`, `hasShops` |
| 定数 | UPPER_SNAKE_CASE | `STORAGE_KEY`, `MAX_NAME_LENGTH` |
| クラス | PascalCase + 役割接尾辞 | `ShopService`, `ShopRepository`, `RouletteView` |
| インターフェース/型 | PascalCase（`I`接頭辞は付けない） | `Shop`, `IconDef`, `RouletteState` |

```typescript
// ✅ 良い例
const enabledShops = shopService.listEnabled();
function getWinner(angleDeg: number, segments: WheelSegment[]): Shop { /* ... */ }
const MAX_NAME_LENGTH = 50;

// ❌ 悪い例
const data = svc.get();          // 役割が不明
function calc(a: any[]): Shop {}  // any禁止・動詞でない・型が曖昧
```

### コードフォーマット（自動）

- **整形**: Prettier（`.prettierrc`）。手動整形に悩まず`npm run format`に任せる。
- **インデント / 行幅 / セミコロン等**: Prettierの設定に従う（議論しない）。
- **静的解析**: ESLint（`eslint.config.js`）。特に以下は**エラー**として強制:
  - `@typescript-eslint/no-explicit-any`: `any`禁止。型が不明なら`unknown`を使い絞り込む。
  - `@typescript-eslint/no-unused-vars`: 未使用変数禁止（`_`接頭辞で意図的に無視可）。
- **型チェック**: `tsconfig.json`の`strict`＋`noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`。`npm run typecheck`で確認。

### 型定義の原則

```typescript
// ✅ 引数・戻り値に明示的な型注釈
function buildSegments(shops: Shop[]): WheelSegment[] { /* ... */ }

// ✅ ユニオン型は型エイリアスで（state machineの表現に有効）
type RouletteState = 'idle' | 'spinning' | 'decelerating' | 'finished';

// ❌ any / 暗黙のany
function build(shops): any {}
```

- 共有する型は`src/types/`に集約し、実装間の循環依存を避ける。
- 型のみのimportは`import type`を使い、実行時依存に含めない。

### 関数設計

- **単一責務**: 1関数1責務。計算と整形を混ぜない（例: 当選判定`getWinner`と演出`playWinnerEffect`を分離）。
- **関数の長さ**: 目標20行、50行超で分割検討。
- **パラメータ**: 3つを超えるならオブジェクトにまとめる（`CreateShopInput`等）。

### 同期処理の方針（本プロジェクト固有）

localStorageは**同期API**のため、`ShopRepository` / `ShopService`のメソッドは`Promise`を返さず**同期**で実装する。`async/await`は不要。

```typescript
// ✅ 本プロジェクトの実装（同期）
class ShopService {
  create(input: CreateShopInput): Shop {
    this.validate(input);
    const shop: Shop = { id: crypto.randomUUID(), enabled: true, /* ... */ };
    const shops = [...this.repo.loadAll(), shop];
    this.repo.saveAll(shops);
    return shop;
  }
}

// ❌ 不要にPromise化しない（localStorageは同期のため意味がない）
async create(input: CreateShopInput): Promise<Shop> { /* ... */ }
```

> 例外: 将来クラウド同期等の非同期I/Oを導入する場合は、Repositoryのインターフェースを非同期化し、上位もそれに追従する。

### コメント規約

- **TSDoc**: 公開クラス・主要メソッドに付与（目的・`@param`・`@returns`・`@throws`）。
- **インラインコメント**: 「何を」ではなく「なぜ」を書く。特にルーレットの角度計算・イージングなど直感に反する箇所は理由を残す。

```typescript
// ✅ なぜを説明（直感に反する計算）
// ホイールがangleDeg回転 ⇒ 針はホイール座標で逆向きに移動するため360から引く
const pointer = (360 - (angleDeg % 360) + 360) % 360;

// ❌ コードの逐語訳
// angleDegを360で割った余りを引く
```

### エラーハンドリング

カスタムエラークラスを`src/types/`または`src/errors.ts`に定義し、種別ごとに扱う。

```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string, public value: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}
class StorageError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}
```

**方針**:
- 予期されるエラー（入力検証）は`ValidationError`をthrowし、Viewが日本語メッセージを表示。
- localStorage読み込み失敗は**例外を投げず空データで継続**（アプリをクラッシュさせない）。書き込み失敗は`StorageError`で通知。
- エラーを握り潰さない（`catch`して`null`を返すだけは禁止）。

### セキュリティ（実装時）

- **XSS対策（最重要）**: ユーザー入力（店名）はDOMへ`textContent`で反映。`innerHTML`への生埋め込み禁止。
- **入力検証**: 店名はtrim後1〜50文字、`iconKey`は許可値のみを`ShopService`で検証。
- **機密情報を持たない**: APIキー等をフロントにハードコードしない（バンドルJSは誰でも読める）。本アプリは外部API連携がないため、そもそもシークレットを扱わない設計。

### パフォーマンス（実装時）

- ルーレット回転は`requestAnimationFrame`で更新し、重い同期処理をフレーム内に入れない。
- 一覧描画は`DocumentFragment`でまとめてDOM挿入し、リフローを抑える。
- ホイールは`transform: rotate()`（GPU合成）で回し、`top`/`left`等のレイアウト変化を使わない。

## Git運用ルール

### ブランチ戦略

個人・小規模開発のため、軽量なトピックブランチ運用を基本とする。

```
main（GitHub Pagesへ配信される安定版）
 ├─ feature/[機能名]   # 新機能（例: feature/roulette-engine）
 ├─ fix/[修正内容]     # バグ修正
 └─ refactor/[対象]    # リファクタリング
```

- **main直接コミットは避ける**: トピックブランチで作業し、PR（またはローカルでの確認）を経てmainへ。
- 規模が大きくなりチーム化したら`develop`を挟むGit Flowへ拡張する（現時点では過剰なので採用しない）。

### コミットメッセージ規約（CLAUDE.md準拠 / 最重要）

> ⚠️ 本プロジェクトは **Conventional Commits を採用しない**。`CLAUDE.md`の規約が最優先。

- **1行・日本語・シンプル**にする。
- `feat:` `chore:` 等のprefixを**付けない**。
- 冗長な補足（例:「（gohan-spin 初期構成）」）を**付けない**。

```
✅ 良い例
ルーレットの回転処理を実装
お店の登録バリデーションを追加
READMEを更新

❌ 悪い例
feat(roulette): add spin logic   # prefix・英語はNG
ルーレットの回転処理を実装（gohan-spin コア体験）  # 冗長な補足はNG
```

### コミット前の自動チェック（husky + lint-staged）

`.husky/pre-commit`で`lint-staged`が走り、ステージしたファイルへ自動で`eslint --fix`＋`prettier --write`が適用される（設定は`package.json`）。コミット時点で最低限の品質が担保される。

### プルリクエスト（該当する場合）

ソロ開発ではPR必須ではないが、節目ではセルフレビュー用にPRを作るとよい。テンプレート例:

```markdown
## 概要
[変更内容の簡潔な説明]

## 変更理由
[なぜこの変更が必要か]

## 変更内容
- [変更点1]
- [変更点2]

## テスト
- [ ] ユニットテスト追加 / パス
- [ ] 手動テスト（Start→Stop→当選演出）実施
- [ ] iPhone Chrome（レスポンシブ）で確認
```

## テスト戦略

### テストピラミッドとカバレッジ

```
   /\
  /E2E\     手動（将来Playwright）: 主要フロー
 /----\
/ 統合 \    Service+Repositoryの永続化
/------\
/ユニット\   Service / Engine / easing（最多）
```

- **カバレッジ目標**: ロジック層で `branches/functions/lines/statements` 各80%以上（`vitest.config.ts`で閾値設定済み・CIで強制）。
- UI層（views）はロジックが薄いため低めでも許容。Service/Engineを厚くテストする。

### テストの書き方（Given-When-Then）

```typescript
import { describe, it, expect } from 'vitest';

describe('ShopService', () => {
  describe('create', () => {
    it('正常な入力でお店を作成でき、enabledはtrueになる', () => {
      // Given
      const service = new ShopService(new InMemoryShopRepository());
      // When
      const shop = service.create({ name: 'バーガーA', iconKey: 'burger' });
      // Then
      expect(shop.id).toBeDefined();
      expect(shop.enabled).toBe(true);
    });

    it('店名が空のときValidationErrorをthrowする', () => {
      const service = new ShopService(new InMemoryShopRepository());
      expect(() => service.create({ name: '', iconKey: 'burger' }))
        .toThrow(ValidationError);
    });
  });
});
```

### 重点テスト項目（本プロジェクト固有）

- `RouletteEngine.getWinner`: 角度→当選判定（区画境界 / 360度跨ぎ / N=1）。
- `RouletteEngine.build`: シャッフルが全件を欠落・重複なく配置すること。
- `easeOutQuint`: `f(0)=0` / `f(1)=1` / 単調増加。
- `ShopRepository`: 破損JSON投入時に例外を投げず空配列で継続（フォールバック）。
- `ShopService`＋`ShopRepository`: 保存→再読込でデータ一致（永続化ラウンドトリップ）。

### モックの方針

- Repositoryはインメモリ実装（`InMemoryShopRepository`）またはvitestのモックで差し替え、Serviceのロジックを純粋に検証。
- Engineは`requestAnimationFrame`に依存するため、タイマー/RAFをモックして決定論的にテストする。

## コードレビュー基準

機能性 / 可読性 / 保守性 / パフォーマンス / セキュリティの観点で確認。特に本プロジェクトでは:

- [ ] Viewがlocalstorageを直接触っていないか（必ずService経由）。
- [ ] ユーザー入力が`textContent`で反映されているか（XSS）。
- [ ] `any`を使っていないか。エラーを握り潰していないか。
- [ ] レイヤー依存方向（UI→Service/Engine→Data）を破っていないか。

**レビューコメントは優先度を明示**: `[必須]` / `[推奨]` / `[提案]` / `[質問]`。建設的に、改善案とセットで書く。

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v24系 | devcontainerで提供 |
| npm | 11系 | パッケージ管理 |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone [URL]
cd gohan-spin

# 2. 依存関係のインストール（husky等のprepareも実行される）
npm ci

# 3. 開発サーバーの起動（Vite）
npm run dev
# サーバーレス構成のため .env 等の環境変数設定は不要
```

### 主要npmスクリプト

| コマンド | 内容 |
|---------|------|
| `npm run dev` | Vite開発サーバー起動（HMR） |
| `npm run build` | 型チェック＋本番ビルド（`dist/`出力） |
| `npm run preview` | ビルド成果物のローカル確認 |
| `npm run lint` | ESLint実行 |
| `npm run format` | Prettierで整形 |
| `npm run typecheck` | `tsc --noEmit`で型チェック |
| `npm run test` | Vitestで全テスト実行 |
| `npm run test:watch` | テストのウォッチ実行 |
| `npm run test:coverage` | カバレッジ計測 |

## CI/CD（推奨構成 / 未導入なら追加検討）

GitHub Actionsで push / PR 時に品質チェックを自動実行する。

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

- **配信**: mainへのマージで`npm run build` → `dist/`をGitHub Pagesへデプロイ（GitHub Pages用のActionsを別途設定）。Viteの`base`をリポジトリ名に合わせる必要がある点に注意（`vite.config.ts`）。

## 実装完了前チェックリスト

- [ ] 命名が規約に沿い、`any`を使っていない。
- [ ] レイヤー依存方向を守っている（View→Service/Engine→Repository）。
- [ ] 入力検証・XSS対策（textContent）が実装されている。
- [ ] ユニットテストを書き、`npm run test`がパスする。
- [ ] `npm run lint` / `npm run typecheck`がパスする。
- [ ] コミットメッセージが「1行・日本語・prefixなし」になっている。
