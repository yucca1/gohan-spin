# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: SoundDirector の変更

- [x] `ensureContext()` で `navigator.audioSession.type = 'playback'` を設定する
  - [x] ローカル型 `AudioSessionLike` でナローイング（グローバル型を汚染しない）
  - [x] `audioSession` 非対応環境では何もしない（no-op方針の踏襲）

## フェーズ2: テスト追加

- [x] `navigator.audioSession` スタブ時、ON切替で `type` が `'playback'` になることを検証
- [x] `navigator.audioSession` が無い環境で例外を投げないこと（既存テストの回帰確認）

## フェーズ3: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`（154件パス）
- [x] リントエラーがないことを確認
  - [x] `npm run lint`
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`
- [x] ビルドが成功することを確認
  - [x] `npm run build`

## フェーズ4: ドキュメント更新

- [x] `docs/architecture.md` の効果音(P1)記述に audioSession 対応を追記
- [x] `docs/functional-design.md` の効果音記述に audioSession 対応を追記
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-06-13

### 計画と実績の差分

**計画と異なった点**:
- なし。design.md の方針（ローカル型ナローイング + `ensureContext()` 内での設定）どおりに実装した

**新たに必要になったタスク**:
- なし

### 学んだこと

**技術的な学び**:
- iOSのWebKitでは Web Audio API がデフォルトで着信音チャンネル（audio session type: `ambient`）で再生され、`<audio>`/`<video>`タグ（メディアチャンネル）と挙動が異なる（WebKit Bug 237322）。マナーモードで無音になり、音量も着信音量に従う
- iOS 17+ では `navigator.audioSession.type = 'playback'` でメディアチャンネルに切り替えられる（標準化前のWebKit独自APIのため、TypeScriptではローカル型でナローイングして使う）
- iPhoneのChrome/Firefox/EdgeはWebKitエンジン強制のため、Safariの音声制約がそのまま適用される

**プロセス上の改善点**:
- 「マナーモード解除済み・音量も上げた」というユーザー報告でも、iOSは着信音量とメディア音量が別系統のため、実際の設定状態を切り分け手順（設定→サウンドと触覚）で確認してもらうのが有効だった

### 次回への改善提案
- モバイル実機依存の音声・センサー系機能は、実装時にOS固有のチャンネル/権限仕様（iOSのaudio session等）を最初に調査してから設計する
