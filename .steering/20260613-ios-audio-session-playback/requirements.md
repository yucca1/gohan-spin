# 要求内容

## 概要

iOS（iPhoneのSafari/Chrome等のWebKit系ブラウザ）で、効果音がマナーモード・着信音量に左右されず「メディア音量」で再生されるようにする。

## 背景

iOSのWebKitでは、Web Audio APIの音声がデフォルトで**着信音チャンネル**（audio session type: `ambient`）で再生される（WebKit Bug 237322）。このため:

- マナーモード（消音スイッチ）ONだと効果音が完全に無音になる
- 音量ボタンで上げ下げできる「メディア音量」ではなく「着信音量」に従うため、ユーザーが音量調整の方法に気づきにくい

実際にユッカの環境（iPhone + Chrome）で「効果音ONなのに音が出ない」事象が発生し、原因がマナーモードであることを確認済み。`<audio>`/`<video>`タグ（YouTube等）はメディアチャンネルで鳴るため、本アプリだけ壊れているように見えてしまう。

iOS 17以降のWebKitには公式の解決策として `navigator.audioSession.type = 'playback'` が用意されており、これを設定するとWeb Audioがメディアチャンネル扱いになる。

## 実装対象の機能

### 1. audio session type の playback 設定

- `SoundDirector` の AudioContext 初期化時に `navigator.audioSession.type = 'playback'` を設定する
- `navigator.audioSession` が存在しない環境（PC各ブラウザ、iOS 16以前、jsdom）では何もしない（既存の no-op 方針を踏襲）
- ユーザーは、マナーモード中でも効果音ONなら音が聞こえ、通常の音量ボタン（メディア音量）で調整できるようになる

## 受け入れ条件

### audio session type の playback 設定

- [ ] 効果音ON切替時、`navigator.audioSession` が存在する環境では type が `'playback'` に設定される
- [ ] `navigator.audioSession` が存在しない環境でも例外を投げず、既存の動作（PC等での再生・jsdomでのno-op）が変わらない
- [ ] 既存テストが全て通り、新規テストで上記2点が検証されている
- [ ] `npm run lint` / `npm run typecheck` / `npm run build` が成功する

## 成功指標

- iPhone（iOS 17+）のChrome/Safariで、マナーモードONでも効果音が再生される
- 効果音の音量がメディア音量（通常の音量ボタン）で調整できる

## スコープ外

以下はこのフェーズでは実装しません:

- iOS 16以前への対応（`audioSession` API が存在しないため従来動作のまま）
- 無音`<audio>`ループ再生などのレガシーなアンロックワークアラウンド
- 効果音ON/OFF状態の永続化や音量スライダー等のUI追加

## 参照ドキュメント

- `docs/architecture.md` - 効果音(P1)の実装方針
- `docs/functional-design.md` - 効果音の機能設計
- `.steering/20260611-add-sound-effects/` - 効果音の初期実装の経緯
- WebKit Bug 237322（webaudio api is muted when the iOS ringer is muted）
