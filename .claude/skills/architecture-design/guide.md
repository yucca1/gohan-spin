# アーキテクチャ設計ガイド

## 基本原則

### 1. 技術選定には理由を明記

**悪い例**:
```
- Node.js
- TypeScript
```

**良い例**（ブラウザSPAの場合）:
```
- Vite (ビルドツール / 開発サーバー)
  - HMR(Hot Module Replacement)による高速な開発体験
  - 本番ビルドは静的アセット(HTML/CSS/JS)を出力し、静的ホスティング(GitHub Pages等)にそのまま載せられる
  - フレームワーク非依存で、素のTypeScript SPAにも適している

- TypeScript 5.x
  - 静的型付けによりコンパイル時にバグを検出でき、保守性が向上
  - IDEの補完機能が強力で、開発効率が高い
  - チーム開発における型定義の共有により、コードの可読性と品質が担保される

- ブラウザ標準API(localStorage / DOM)
  - サーバーレス構成のため、データ永続化は localStorage で完結(追加依存なし)
  - DOM APIで描画を制御し、外部UIフレームワークなしでも軽量に実装できる
  - 対象ブラウザ(例: Chrome最新版)のサポート範囲を明記して選定する
```

### 2. レイヤー分離の原則

各レイヤーの責務を明確にし、依存関係を一方向に保ちます:

```
UI → Service → Data (OK)
UI ← Service (NG)
UI → Data (NG)
```

### 3. 測定可能な要件

すべてのパフォーマンス要件は測定可能な形で記述します。

## レイヤードアーキテクチャの設計

### 各レイヤーの責務

**UI（表示）レイヤー**:
```typescript
// 責務: DOMの描画、ユーザー操作(クリック等)の受付とバリデーション
class ItemListView {
  // OK: サービスレイヤーを呼び出す
  async onAddClick(name: string) {
    const item = await this.itemService.create({ name });
    this.render(); // 画面を再描画
  }

  // NG: データレイヤー(localStorage)を直接触る
  async onAddClick(name: string) {
    localStorage.setItem(name, '...'); // ❌ ビジネスロジックを飛ばしている
  }
}
```

**サービス（ドメイン）レイヤー**:
```typescript
// 責務: ビジネスロジックの実装(UIにもストレージにも依存しない純粋なロジック)
class ItemService {
  async create(data: CreateItemData): Promise<Item> {
    const item: Item = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    return this.repository.save(item);
  }
}
```

**データレイヤー**:
```typescript
// 責務: データの永続化(ここでは localStorage)
class ItemRepository {
  private readonly KEY = 'app:items';

  async save(item: Item): Promise<Item> {
    const items = this.loadAll();
    items.push(item);
    localStorage.setItem(this.KEY, JSON.stringify(items));
    return item;
  }
}
```

## パフォーマンス要件の設定

### 具体的な数値目標（ブラウザSPAの場合）

```
初期表示(First Contentful Paint): 1.5秒以内
└─ 測定方法: Chrome DevTools の Lighthouse / Performance パネルで計測
└─ 測定環境: デスクトップChrome最新版、標準的なPC

一覧描画: 100件まで100ms以内で再描画
└─ 測定方法: performance.now() で描画前後の差分を計測
└─ 許容範囲: 数十件規模なら体感の遅延なし

アニメーション: 60fps(1フレーム16.7ms以内)を維持
└─ 測定方法: DevTools の Performance パネルでフレーム落ちを確認
└─ 実装方針: requestAnimationFrame を使い、重い処理をフレーム内に詰め込まない
```

## セキュリティ設計

### データ保護の3原則（ブラウザSPAの場合）

1. **XSS対策（最重要）**
```typescript
// ユーザー入力をDOMに反映するときは innerHTML を避け、textContent を使う
element.textContent = userInput; // OK: HTMLとして解釈されない
element.innerHTML = userInput;   // ❌ スクリプト注入(XSS)の危険
```

2. **入力検証**
```typescript
function validateName(name: string): void {
  if (!name || name.length === 0) {
    throw new ValidationError('名前は必須です');
  }
  if (name.length > 200) {
    throw new ValidationError('名前は200文字以内です');
  }
}
```

3. **機密情報を持たない / localStorageに置かない**
```
- ブラウザのみで完結する構成では、APIキー等のシークレットをフロントに置かない
  (バンドルされたJSは誰でも閲覧できるため)
- localStorage はオリジン内のJSから自由に読めるので、機微な情報を保存しない
- 外部配信は HTTPS(GitHub Pages等は既定でHTTPS)で行う
```

## スケーラビリティ設計

### データ増加への対応

**想定データ量**: [例: 数十〜数百件のアイテム]

**localStorageの制約**:
- 1オリジンあたり概ね5MB程度の容量上限がある
- 同期APIのため、巨大データのJSON化はメインスレッドをブロックしうる

**対策**:
- データ量が大きくなる場合は IndexedDB への移行を検討
- 一覧が増える場合は仮想スクロールや遅延描画で描画負荷を抑える
- 保存スキーマにバージョン番号を持たせ、将来のマイグレーションに備える

```typescript
// 保存スキーマにバージョンを持たせる例
interface StoredData {
  version: 1;          // スキーマ変更時にインクリメントしてマイグレーション
  items: Item[];
}
```

## 依存関係管理

### バージョン管理方針

```json
{
  "dependencies": {
    "canvas-confetti": "^1.9.0"  // 実行時に使う演出ライブラリ等
  },
  "devDependencies": {
    "vite": "^8.0.0",         // ビルド/開発サーバー
    "typescript": "~5.3.0",   // パッチバージョンのみ自動(~)
    "vitest": "^4.0.0",       // テスト
    "eslint": "^9.0.0"
  }
}
```

**方針**:
- 安定版は固定(^でマイナーバージョンまで許可)
- 破壊的変更のリスクがある場合は完全固定
- devDependenciesはパッチバージョンのみ自動(~)

## チェックリスト

- [ ] すべての技術選定に理由が記載されている
- [ ] レイヤードアーキテクチャが明確に定義されている
- [ ] パフォーマンス要件が測定可能である
- [ ] セキュリティ考慮事項が記載されている
- [ ] スケーラビリティが考慮されている
- [ ] バックアップ戦略が定義されている
- [ ] 依存関係管理のポリシーが明確である
- [ ] テスト戦略が定義されている