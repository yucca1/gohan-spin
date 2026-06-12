# 🍚 gohan-spin

外食するお店をルーレットで決める、家族で盛り上がるブラウザWebアプリです。

「今日どこ行く？」という迷いの時間を、リーチ演出・点滅ズーム・紙吹雪・効果音で「家族みんなでドキドキする時間」に変えます。

## ✨ 特徴

- **インストール不要**: ブラウザでURLを開くだけ。アカウント登録もサーバーも不要
- **演出で盛り上がる**: リーチ演出・当選時の紙吹雪・効果音つきのルーレット
- **自分のお店リストで完結**: よく行くお店を登録し、その日の気分で対象を選んで回せる
- **データは端末内に保存**: localStorageを使用し、外部にデータを送信しません
- **PC・スマホ両対応**: デスクトップChromeとiPhoneのChromeで快適に動作するレスポンシブUI

## 🚀 使い方

1. お店の名前とアイコンを指定して、よく行くお店を登録する
2. 今日の候補にしたいお店を選ぶ
3. ルーレットをスタートして、ストップ！
4. 当選演出で盛り上がったら、お店へGO！

## 🛠️ 開発

### 必要な環境

- Node.js v24 以上
- npm

### セットアップ

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

### その他のコマンド

| コマンド | 説明 |
| --- | --- |
| `npm run build` | 型チェック + 本番ビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm test` | テストの実行（Vitest） |
| `npm run test:coverage` | カバレッジ付きテスト |
| `npm run lint` | ESLintによる静的解析 |
| `npm run format` | Prettierによるフォーマット |
| `npm run typecheck` | TypeScriptの型チェック |

## 🧰 技術スタック

- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Vitest](https://vitest.dev/)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)（紙吹雪演出）
- Web Audio API（効果音）
- localStorage（データ保存）

フレームワークを使わない Vanilla TypeScript 構成で、ビュー・サービス・リポジトリの層に分かれた設計になっています。詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

## 📄 ライセンス

[MIT License](LICENSE)
