# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
技術的理由（実装方針変更・アーキテクチャ変更・依存関係変更）のみ。スキップ時は理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: Engine層（純粋計算）

- [x] ルーレット固有型を定義する（`src/types/Roulette.ts`）
  - [x] `WheelSegment` / `RouletteState` / `AngleListener` を定義
- [x] イージング関数を実装する（`src/engine/easing.ts`）
  - [x] `easeOutQuint` を純粋関数で実装
- [x] `RouletteEngine` の区画構築・当選判定を実装する（`src/engine/RouletteEngine.ts`）
  - [x] Fisher-Yatesシャッフルによる `build()`（等分割当・最終区画endAngle=360・隣接色割当）
  - [x] `getWinner()`（二重modの角度正規化・末尾区画の360扱い）
- [x] `RouletteEngine` の回転制御を実装する
  - [x] `start()`（等速回転・RAFループ・stateガード）
  - [x] `stop()`（easeOutQuint減速・4〜6周＋ランダム着地・onFinish一度だけ）
  - [x] `reset()`（cancelAnimationFrame・idleへ復帰）
- [x] Engine層のユニットテストを書く
  - [x] `tests/unit/engine/easing.test.ts`（f(0)=0 / f(1)=1 / 単調増加）
  - [x] `tests/unit/engine/RouletteEngine.test.ts` の `build`（全件配置・等分・色・N=1・空配列）
  - [x] 同 `getWinner`（境界・360跨ぎ・pointer=0・負角度）
  - [x] 同 `start`/`stop`/`reset`（RAFモックで状態遷移・onFinish一度だけ）

## フェーズ2: View層とUI統合

- [x] `RouletteView` を実装する（`src/views/RouletteView.ts`）
  - [x] DOM骨格（針・canvasホイール・Start/Stopボタン・案内メッセージ・当選オーバーレイ）
  - [x] `renderWheel()`（canvasへ扇形・絵文字・店名を描画。contextがnullなら安全にスキップ）
  - [x] `setAngle()`（CSS transformで回転反映）
  - [x] `setPhase()` / `setControlsEnabled()`（ボタン活性・0件メッセージ）
  - [x] `playWinnerEffect()` / `hideWinner()`（点滅・ズーム・店名textContent・confetti・もう一度）
- [x] スタイルを追加する（`src/styles/main.css`）
  - [x] 2カラム⇔縦積みのレスポンシブレイアウト
  - [x] ホイール・針・ボタンのスタイル
  - [x] 当選演出アニメーション（`.is-blinking` / `.is-zoomed`）
- [x] `main.ts` を結線する
  - [x] `#app` 内に2カラムコンテナを生成し各Viewへ注入
  - [x] onStart/onStop/onResetハンドラの結線
  - [x] お店CRUD成功時のアイドル中ホイール再構築＋Start活性更新

## フェーズ3: View層テスト

- [x] `tests/unit/views/RouletteView.test.ts` を書く
  - [x] ボタン操作→ハンドラ呼び出し（onStart/onStop/onReset）
  - [x] `setPhase` のボタン活性制御・`setControlsEnabled(false)` の案内表示
  - [x] `playWinnerEffect` の店名textContent反映・confetti呼び出し（モック）
  - [x] canvas contextがnullでも例外を投げない

## フェーズ4: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（121件パス・カバレッジ全体90%超/View層60%基準クリア）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`

## フェーズ5: ドキュメント更新

- [x] `docs/product-requirements.md` のルーレット/当選演出の受け入れ条件チェックを更新
- [x] `docs/repository-structure.md` に `src/engine/easing.ts` と `src/types/Roulette.ts` を反映
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-10

### 計画と実績の差分

**計画と異なった点**:
- `RouletteEngine.reset()` は当初「currentAngle を保持する」設計だったが、implementation-validator の指摘（リセット後にホイールの CSS transform が回転したまま残り、再構築した区画と表示がズレて見える）を受けて「角度も 0 に戻す」仕様へ変更した。`main.ts` の onReset でも `setAngle(0)` を呼び、Engine と View の表示を一致させた。
- `docs/architecture.md` / `docs/development-guidelines.md` / `docs/repository-structure.md` にあった「tsconfig の include に tests/ が含まれない」という注記は実態（既に追加済み）と乖離していたため、本作業のドキュメント更新で3箇所とも解消した。

**新たに必要になったタスク**:
- implementation-validator の[推奨]対応: `build([])` の早期リターンガード（`360 / 0 = Infinity` の防止）、リセット時の角度初期化。
- [提案]対応: disabled の Stop ボタンクリックで onStop が呼ばれないことのテスト追加（計122テスト）。

### 学んだこと

**技術的な学び**:
- 「停止角度を先に乱数で決め、当選を逆算する」方式により、抽選の公平性とアニメーション演出を完全に分離できる。
- canvas への扇形描画は一度だけ行い、回転は canvas 要素への CSS `transform: rotate()`（GPU合成）で行うことで、毎フレームの再描画なしに60fpsの回転を実現できる。
- jsdom には canvas 2D コンテキストがないため、`getContext('2d')` の null ガードを入れることで「描画はスキップ・振る舞いはテスト可能」という設計にできる（RAF・performance.now はフェイク実装で決定論的にテスト）。
- canvas の arc は「3時方向=0ラジアン」、ホイール区画は「12時方向=0度」なので、-90度のオフセット変換が必要（座標系の違いに注意）。

**プロセス上の改善点**:
- 機能設計書（A-1〜A-4のアルゴリズム・擬似コード）が詳細だったため、実装時の迷いがほぼなかった。設計ドキュメントへの先行投資が効いた。
- implementation-validator のレビューで「実際には到達しないが意図と異なる挙動」（Infinity計算・フォールバック不全）を拾えた。自動テストだけでは見つけにくい品質の穴をサブエージェント検証で補完できた。

### 次回への改善提案
- 実機（iPhone Chrome）での確認が未実施の受け入れ条件が2件残っている（ホイールの画面内収まり・アニメーションの滑らかさ）。次回は `npm run dev` での手動確認またはChrome DevTools MCPでのレスポンシブ確認を作業フローに含めると良い。
- GitHub Pages 配信時には `vite.config.ts` の `base: '/gohan-spin/'` 設定が必要（未対応・配信準備タスクとして別途実施）。
