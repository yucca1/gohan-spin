# 設計書

## アーキテクチャ概要

既存の `SoundDirector`（`src/audio/SoundDirector.ts`）への小規模な追加。新しいレイヤーやファイルは追加しない。

```
[効果音ONクリック]
  → SoundDirector.toggle()
    → ensureContext()
      ├─ applyPlaybackAudioSession()  ← 今回追加（iOS 17+ のみ実効）
      └─ new AudioContext() / resume()
```

## コンポーネント設計

### 1. SoundDirector（変更）

**責務**:
- AudioContext 初期化時に、iOSのaudio sessionを `'playback'` に設定する（対応環境のみ）

**実装の要点**:
- `navigator.audioSession` は WebKit 独自API（iOS 17+）で、TypeScriptの標準型定義（`lib.dom.d.ts`）に存在しない
  - グローバル型を汚染しないよう、`SoundDirector.ts` 内のローカル型でナローイングする:
    ```ts
    interface AudioSessionLike {
      type: string;
    }
    const audioSession = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    if (audioSession) audioSession.type = 'playback';
    ```
- 設定タイミングは `ensureContext()` の AudioContext 生成・resume の前。ON切替のたびに呼ばれるが、同じ値の再代入は無害
- 既存の「効果音は演出。失敗してもアプリ本体を止めない」方針に合わせ、万一の例外も `ensureContext()` 内の既存 try/catch 方針に倣って握りつぶす（音以外へ波及させない）
- jsdom には `navigator.audioSession` が無いため、既存テストはそのまま通る

## データフロー

### 効果音ONへの切替（iOS 17+）
```
1. ユーザーが「効果音 OFF」ボタンをクリック
2. SoundDirector.toggle() → isEnabled = true
3. ensureContext() が navigator.audioSession.type = 'playback' を設定
4. AudioContext を生成（または resume）
5. 以降の効果音はメディアチャンネルで再生される
   （マナーモードの影響を受けず、メディア音量で調整可能）
```

## エラーハンドリング戦略

### カスタムエラークラス

追加なし。

### エラーハンドリングパターン

- `audioSession` への代入で予期せぬ例外が出ても効果音を止めるだけで、アプリ本体は継続する（既存方針の踏襲）

## テスト戦略

### ユニットテスト（tests/unit/audio/SoundDirector.test.ts に追加）

- `navigator.audioSession` をスタブした状態で `toggle()`（ON）すると `type` が `'playback'` になる
- `navigator.audioSession` が無い環境（jsdom素の状態）でも例外を投げない（既存テストで担保済みのため、回帰しないことを確認）

### 統合テスト

追加なし（実機依存の挙動のため、iPhone実機での手動確認を受け入れ条件とする）。

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
src/audio/SoundDirector.ts          # 変更（audioSession設定の追加）
tests/unit/audio/SoundDirector.test.ts  # 変更（テスト追加）
```

## 実装の順序

1. `SoundDirector.ts` に `applyPlaybackAudioSession`（相当の処理）を追加
2. ユニットテストを追加
3. 品質チェック（test / lint / typecheck / build）
4. ドキュメント更新（architecture.md / functional-design.md の効果音記述に1文追記）

## セキュリティ考慮事項

- なし（外部入力・シークレットを扱わない）

## パフォーマンス考慮事項

- `audioSession.type` への代入はON切替時の1回（再切替時も単純代入）で、フレームループには影響しない

## 将来の拡張性

- 将来 `navigator.audioSession` の型が `lib.dom.d.ts` に取り込まれたら、ローカル型 `AudioSessionLike` を削除して標準型へ移行できる
