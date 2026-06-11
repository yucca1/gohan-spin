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

### タスクが大きすぎる場合
- タスクを小さなサブタスクに分割
- 分割したサブタスクをこのファイルに追加
- サブタスクを1つずつ完了させる

---

## フェーズ1: 型定義と SoundDirector の実装

- [x] `src/types/Roulette.ts` に `RouletteSounds` インターフェースを追加
  - [x] `enabled` / `toggle()` / `setSegmentCount()` / `handleAngle()` / `handlePhase()` を定義
  - [x] TSDoc を付与（既存型のコメントスタイルに合わせる）

- [x] `src/audio/SoundDirector.ts` を新規作成
  - [x] 純粋関数 `segmentIndexAt(angleDeg, segmentCount)` を export（境界判定の本体）
  - [x] `SoundDirector` クラスの骨格（enabled 初期 false / toggle / AudioContext 遅延初期化 / jsdom で no-op）
  - [x] カチカチ音の合成（矩形波の短いクリック・約30msスロットル）
  - [x] ドラムロールの合成（ノイズバッファの loop 再生 + 約10秒クレッシェンド・開始/停止）
  - [x] ファンファーレの合成（三角波アルペジオ + 和音）
  - [x] `handlePhase` の状態対応（spinning=トラッキングリセット / decelerating=ドラムロール開始 / finished=停止+ファンファーレ / idle=全停止）
  - [x] 減速中に toggle で ON にしたらドラムロールを開始する対応

## フェーズ2: SoundDirector のユニットテスト

- [x] `tests/unit/audio/SoundDirector.test.ts` を新規作成
  - [x] 初期状態で `enabled === false` を検証
  - [x] `toggle()` の反転と戻り値を検証
  - [x] jsdom（AudioContext なし）で各メソッドが例外を投げないことを検証
  - [x] `segmentIndexAt` の境界値テスト（境界前後・360超の角度・count=1）

## フェーズ3: RouletteView への統合

- [x] `src/views/RouletteView.ts` を変更
  - [x] コンストラクタ第2引数に `sounds?: RouletteSounds` を追加
  - [x] 🔊/🔇トグルボタンを描画（sounds 注入時のみ・`aria-pressed` 付き・初期🔇）
  - [x] `renderWheel` → `setSegmentCount` / `setAngle` → `handleAngle` / `setPhase` → `handlePhase` の転送を追加
- [x] `src/styles/main.css` に `.sound-btn` のスタイルを追加（既存ボタンとトーンを揃える）
- [x] `tests/unit/views/RouletteView.test.ts` に追記
  - [x] fake `RouletteSounds` でトグルボタンの描画・押下時の `toggle()` 呼び出し・表示切替を検証
  - [x] `setPhase` / `setAngle` / `renderWheel` の転送を検証
  - [x] sounds 未注入時はトグルボタンが描画されないことを検証

## フェーズ4: 結線

- [x] `src/main.ts` で `SoundDirector` を生成し `RouletteView` へ注入

## フェーズ5: 品質チェックと修正

- [x] （実装中に追加）AudioContext スタブによる再生経路のテストを追加（カバレッジ閾値対応）
  - [x] FakeAudioContext で ON切替時の生成 / OFF時の非生成を検証
  - [x] ドラムロールの開始（loop）・finished/idle での停止・多重開始防止を検証
  - [x] ファンファーレの音符スケジュールを検証
  - [x] カチカチ音の発音と30msスロットルを検証
  - [x] `npm run test:coverage` が閾値を満たすことを確認（branches 87.22% / src/audio 92.45%）

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（152件パス）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`

## フェーズ6: ドキュメント更新

- [x] `docs/repository-structure.md` を更新（`src/audio/` を実体として記載・views の依存可能先に audio を追加・拡張ポイントの記述を実装済みへ）
- [x] `docs/functional-design.md` の Post-MVP 拡張ポイントの効果音記述を「実装済み」へ更新
- [x] `docs/architecture.md` の機能拡張性（効果音）の記述を実装に合わせて更新
- [x] 実装後の振り返り（このファイルの下部に記録）

## フェーズ7: 動作確認フィードバックの反映（2026-06-11）

> ユーザー動作確認の結果: カチカチ音・ファンファーレは好評。ドラムロールは不要。
> ON/OFF表示は絵文字では分かりにくいため、テキストのみ（「効果音 ON/OFF」+ 色変化）へ変更する。

- [x] ドラムロールを削除（`SoundDirector.ts` から合成・開始/停止処理と関連定数を除去）
- [x] `tests/unit/audio/SoundDirector.test.ts` からドラムロール関連テストを削除・調整
- [x] トグルボタンをテキスト表現「効果音 ON/OFF」へ変更（`RouletteView.ts`・ON時は緑/OFF時はグレーのCSS）
- [x] `tests/unit/views/RouletteView.test.ts` の表示検証をテキスト表現へ更新
- [x] ドキュメント更新（PRD・機能設計・リポジトリ構造・steering requirements/design のドラムロール/表示記述）
- [x] 品質チェック再実行（テスト149件パス・カバレッジ閾値クリア・lint/typecheck/build OK）
- [x] 振り返りにフィードバック反映の記録を追記

## フェーズ8: 追加フィードバックの反映（2026-06-11）

> ユーザー動作確認の結果: 「もう一度」押下時にカチカチ音が1回鳴る不具合の指摘。
> 原因: リセットで角度が0へ巻き戻る際、減速終端の通算角度との差を境界通過と誤検知していた。

- [x] カチカチ音を「ホイールが動いている状態（spinning / decelerating）」に限定するゲートを追加（`SoundDirector.ts`）
- [x] リグレッションテストを追加（finished 後の角度リセット / idle 中の角度更新 / 減速中は鳴り続ける）
- [x] 品質チェック再実行（テスト152件パス・カバレッジ閾値クリア・lint/typecheck/build OK）

---

## 実装後の振り返り

### 実装完了日
2026-06-11

### 計画と実績の差分

**計画と異なった点**:
- 計画時のテスト戦略は「Web Audio の発音は自動テストせず手動確認」だったが、`npm run test:coverage` のグローバル閾値（branches 80%）に未達（78.88%）となったため、`FakeAudioContext` スタブによる再生経路のテストを追加した。結果として branches 87.22%（src/audio 単体 92.45%・Functions 100%）まで向上し、「ドラムロールが finished/idle で止まる」「30msスロットル」など受け入れ条件に直結する振る舞いの自動検証も得られた。

**新たに必要になったタスク**:
- AudioContext スタブによる再生経路テストの追加（フェーズ5に追記）。理由: カバレッジ閾値対応。副産物として回帰検知能力が上がった。

### 学んだこと

**技術的な学び**:
- Web Audio API は `OscillatorNode`（カチカチ・ファンファーレ）と `AudioBuffer` のノイズ生成 + loop 再生（ドラムロール）だけで、音声ファイルなしに3種類の効果音を合成できる。
- `AudioContext` はユーザー操作起点で生成・`resume()` すれば Chrome/iOS の自動再生制限を自然に回避できる。「初期ミュート + ON切替時に遅延生成」はこの制限と相性が良い。
- 区画境界の通過判定は「通算角度を `floor(angle / 区画角)` した整数インデックスの変化」で実装でき、減速で角度が360を超え続ける Engine の仕様がそのまま活きた（正規化すると区画1件の周回が検知できなくなる点に注意）。
- 既存の `setPhase` / `setAngle` が効果音に必要な情報をすべて持っていたため、Engine・main の結線は無改修で済んだ。状態機械を細かく設計しておくと後付けの演出が安くなる。

**プロセス上の改善点**:
- 要件精緻化の段階で「初期OFF」「減速中もカチカチ継続」「途中ON切替の挙動」まで決めてあったため、実装中の判断の迷いがなかった。
- カバレッジ閾値は計画段階で `vitest.config.ts` を確認しておくべきだった（テスト戦略の見積もりが1回ぶれた）。

### 次回への改善提案
- 新しいディレクトリ（レイヤー）を追加する機能では、計画時に `vitest.config.ts` のカバレッジ閾値・除外設定を確認し、テスト戦略に織り込む。
- ブラウザAPI依存のモジュールは今回の `FakeAudioContext` のように「生成物を記録する薄いスタブ」を最初からテスト戦略に含めると、no-op テストだけで終わらず振る舞いまで守れる。

### フィードバック反映（2026-06-11 追記）

**ユーザー動作確認の結果**:
- カチカチ音・ファンファーレは好評。**ドラムロールは削除**（減速中はカチカチの間隔が伸びる演出のみが残る）。
- 絵文字トグル（🔊/🔇）は分かりにくいとの指摘 → 表現案4つ（自作SVG/絵文字+テキスト/テキストのみ/スイッチ風）を提示し、**「効果音 ON/OFF」のテキストのみ（ON=緑/OFF=グレー）** を採用。

**学び**:
- 音の演出は実装が正しくても「体験として過剰」になりうる。合成音をモジュール内に閉じ込めてあったため、削除は `SoundDirector` とテストの修正だけで済み、View/main は無改修だった（インターフェース分離の効果）。
- 絵文字はプラットフォームによる見た目差・小ささで誤読されやすい。状態を伝えるUIは「文字で書く」のが最も確実という好例。
