# 設計書

> 作成日: 2026-06-11
> 入力: `requirements.md` / `docs/architecture.md` / `docs/repository-structure.md`
> ⚠️ 2026-06-11 追記: 動作確認フィードバックにより **ドラムロール（合成・開始/停止・途中開始）は削除**、
> トグルボタンは **「効果音 ON/OFF」のテキスト表示（ON=緑/OFF=グレー）** へ変更した。
> 本文中のドラムロール・🔊/🔇 に関する記述は当初設計の記録として残す（tasklist.md フェーズ7参照）。

## アーキテクチャ概要

`repository-structure.md` の拡張予約どおり、新設 `src/audio/` に効果音モジュールを追加する。
既存のレイヤード構成は変えず、**効果音は「演出」として UI レイヤー（RouletteView）に注入**する。
RouletteEngine・ShopService・Repository は一切変更しない。

```
main.ts（組み立て）
  │  new SoundDirector() を生成し RouletteView へ注入
  ▼
RouletteView（UIレイヤー・演出）
  │  既存の受け口をそのまま転送するだけ:
  │   - renderWheel(segments) → sounds.setSegmentCount(segments.length)
  │   - setAngle(angle)       → sounds.handleAngle(angle)
  │   - setPhase(state)       → sounds.handlePhase(state)
  │   - 🔊/🔇ボタン押下       → sounds.toggle()
  ▼
SoundDirector（src/audio/ 新設）
  │  状態遷移と角度から「いつ何を鳴らすか」を判断し、
  │  Web Audio API（AudioContext）で音を合成・再生する
  ▼
Web Audio API（ブラウザ標準・追加依存なし）
```

**この構成を選んだ理由**:
- `RouletteView.setPhase()` が既に全状態遷移（spinning/decelerating/finished/idle）を、
  `setAngle()` が毎フレームの角度を受け取っており、効果音に必要な情報が UI レイヤーに揃っている。
- main.ts の結線・Engine の計算ロジックを無改修で済ませられる（変更箇所の最小化）。
- canvas-confetti（紙吹雪）と同じ「View が演出を呼ぶ」既存パターンに一致する。

## コンポーネント設計

### 1. RouletteSounds インターフェース（src/types/Roulette.ts に追加）

**責務**:
- View が依存する効果音の抽象（ポート）。View は実装（Web Audio）を知らない。

```typescript
export interface RouletteSounds {
  /** 現在音が有効か（ミュートトグルの表示に使う） */
  readonly enabled: boolean;
  /** 音のON/OFFを切り替え、新しい状態を返す */
  toggle(): boolean;
  /** ホイールの区画数を設定する（カチカチ音の境界判定に使う） */
  setSegmentCount(count: number): void;
  /** 毎フレームの回転角度を受け取り、区画境界の通過でカチカチ音を鳴らす */
  handleAngle(angleDeg: number): void;
  /** 状態遷移を受け取り、ドラムロール開始/停止・ファンファーレを再生する */
  handlePhase(state: RouletteState): void;
}
```

**実装の要点**:
- `types/` に置くのは View（UI層）と audio（演出実装）の双方から参照される共有型のため
  （`WheelSegment` / `RouletteState` と同じ理由）。
- テストでは fake 実装（呼び出し記録を残すだけ）に差し替えられる。

### 2. SoundDirector（src/audio/SoundDirector.ts 新設）

**責務**:
- `RouletteSounds` の Web Audio API 実装。3種類の音の合成・再生と、ミュート状態の管理。
- 区画境界の通過判定（前回角度との比較）。

**状態遷移と音の対応**:

| handlePhase の引数 | 動作 |
|---|---|
| `spinning` | 角度トラッキングをリセット（以降 handleAngle でカチカチ） |
| `decelerating` | ドラムロール開始（カチカチは handleAngle が継続） |
| `finished` | ドラムロール停止 + ファンファーレ再生 |
| `idle` | 全音停止（「もう一度」での鳴りっぱなし防止） |

**音の合成方法（すべて Web Audio API・追加依存なし）**:

| 音 | 合成方法 |
|---|---|
| カチカチ | 短い矩形波（OscillatorNode・高め周波数・約30msで急減衰） |
| ドラムロール | ホワイトノイズの連打（1秒分の AudioBuffer を生成して loop 再生。GainNode で約10秒かけてクレッシェンド） |
| ファンファーレ | 三角波のアルペジオ（ド→ミ→ソ→高いド）+ 最後に和音を伸ばす |

**実装の要点**:
- **遅延初期化**: `AudioContext` は「音がONで初めて音を鳴らす/ONに切り替えた」時に生成する。
  初期OFFの間は一切生成しない（要件）。生成はユーザー操作（クリック）起点になるため
  Chrome/iOS の自動再生制限を自然に回避できる。`state === 'suspended'` なら `resume()` する。
- **jsdom安全**: `AudioContext` が存在しない環境では全メソッドが no-op（クラッシュさせない。
  効果音は演出であり、失敗してもアプリ本体を止めない）。`try/catch` で握り、エラーは投げない。
- **境界判定**: Engine の角度は減速中 360 を超えて増え続けるため、
  `Math.floor(angleDeg / (360 / segmentCount))` の整数インデックスが前回と変わったら通過とみなす
  （等速中の `% 360` ラップでもインデックスが変わるので同じ式で判定できる）。
- **カチカチのスロットル**: 区画数が多いと毎秒100回近く鳴り得るため、最低間隔（約30ms）で間引く
  （音のスケジューリング負荷から 60fps を守る）。
- **減速中のON切替**: 直近の `handlePhase` の状態を保持し、`toggle()` でONになった瞬間に
  `decelerating` ならドラムロールを開始する（受け入れ条件）。
- **マスターゲイン**: 全音を 1 つの GainNode（音量約0.3）経由で出力し、音割れ・爆音を防ぐ。

### 3. RouletteView の拡張（src/views/RouletteView.ts 変更）

**責務**（追加分）:
- コンストラクタ第2引数で `RouletteSounds` を**省略可能**として受け取る。
- 🔊/🔇トグルボタンを `roulette-controls` 内に描画し、押下で `sounds.toggle()` →表示更新。
- `renderWheel` / `setAngle` / `setPhase` から sounds へ転送する（各1行）。

**実装の要点**:
- `sounds` 未注入（既存テスト・sounds なし運用）では トグルボタンを描画せず、転送もしない
  （`this.sounds?.handleAngle(...)` のオプショナル呼び出し）。既存テストは無改修で通る。
- トグルボタンは `aria-pressed` で ON/OFF を表現し、表示は `textContent` で 🔊/🔇 を切り替える。
- ボタンはルーレットの状態に関係なく常に押せる（回転中のミュートを許可）。

### 4. main.ts の変更

- `new RouletteView(rouletteRoot, new SoundDirector())` — 注入1箇所のみ。

## データフロー

### 音ONで Start → Stop → 確定する流れ
```
1. ユーザーが🔇を押す → View が sounds.toggle() → SoundDirector が AudioContext を生成（ユーザー操作起点）→ 🔊表示
2. Start押下 → main が engine.start() / view.setPhase('spinning') → sounds.handlePhase('spinning')（トラッキング開始）
3. 毎フレーム engine → view.setAngle(angle) → sounds.handleAngle(angle) → 区画境界通過ごとにカチカチ音
4. Stop押下 → view.setPhase('decelerating') → sounds.handlePhase('decelerating') → ドラムロール開始（カチカチは3が継続・自然に間隔が伸びる）
5. 着地 → view.setPhase('finished') → sounds.handlePhase('finished') → ドラムロール停止 + ファンファーレ
6. 「もう一度」→ view.setPhase('idle') → sounds.handlePhase('idle') → 全音停止
```

## エラーハンドリング戦略

### カスタムエラークラス

追加しない。効果音は「演出」であり、失敗してもアプリ本体（抽選・お店管理）を止めてはならない。

### エラーハンドリングパターン

- `AudioContext` の生成・再生に失敗した場合は `try/catch` で握り、以降 no-op として継続する
  （`console.warn` で開発者向けに痕跡だけ残す）。
- 「エラーを握り潰さない」原則の例外であることを設計判断として明記する:
  効果音の失敗はユーザーに通知する価値がなく、リカバリ手段もないため。

## テスト戦略

### ユニットテスト

- **`tests/unit/audio/SoundDirector.test.ts`（新規）**:
  - 初期状態で `enabled` が `false`（初期OFF要件）
  - `toggle()` で `enabled` が反転し、新しい値を返す
  - jsdom（`AudioContext` なし）で `handleAngle` / `handlePhase` / `setSegmentCount` を呼んでも例外を投げない
  - 区画境界の通過判定ロジック（exportした純粋関数 `segmentIndexAt(angleDeg, count)` を直接検証:
    境界前後・360度ラップ・count=1）
- **`tests/unit/views/RouletteView.test.ts`（追記）**:
  - fake `RouletteSounds` を注入し:
    - 🔊/🔇ボタンが描画され、押下で `toggle()` が呼ばれ表示が切り替わる
    - `setPhase(state)` が `handlePhase(state)` へ転送される
    - `setAngle(angle)` が `handleAngle(angle)` へ転送される
    - `renderWheel(segments)` が `setSegmentCount(segments.length)` へ転送される
  - sounds 未注入時はトグルボタンが描画されない（既存動作の不変）

> Web Audio の発音そのもの（音色・音量）は自動テストせず、手動の動作確認で検証する
> （jsdom に AudioContext がなく、音の正しさは聴覚でしか判定できないため）。

### 統合テスト

- 追加しない（効果音は永続化・サービス層に関与しないため、既存の統合テスト範囲に変更なし）。

## 依存ライブラリ

追加なし。Web Audio API（ブラウザ標準）のみで実装する。

## ディレクトリ構造

```
src/
├── audio/                      # 新設
│   └── SoundDirector.ts        # RouletteSounds の Web Audio 実装 + segmentIndexAt（純粋関数）
├── types/
│   └── Roulette.ts             # RouletteSounds インターフェースを追加
├── views/
│   └── RouletteView.ts         # sounds 注入・🔊/🔇ボタン・転送3行を追加
├── styles/
│   └── main.css                # .sound-btn のスタイルを追加
└── main.ts                     # SoundDirector を生成して注入（1行）

tests/
└── unit/
    ├── audio/                  # 新設
    │   └── SoundDirector.test.ts
    └── views/
        └── RouletteView.test.ts  # 効果音転送・トグルのテストを追記
```

## 実装の順序

1. `types/Roulette.ts` に `RouletteSounds` を追加（最下層から）
2. `src/audio/SoundDirector.ts` を実装（純粋関数 `segmentIndexAt` → クラス本体）
3. `tests/unit/audio/SoundDirector.test.ts` を作成して検証
4. `RouletteView` に注入・トグルボタン・転送を追加 + CSS
5. `tests/unit/views/RouletteView.test.ts` に追記して検証
6. `main.ts` で結線
7. 品質チェック（test / lint / typecheck / build）→ ドキュメント更新

## セキュリティ考慮事項

- ユーザー入力を扱わない（音の合成パラメータはすべて定数）。XSS・インジェクションの懸念なし。
- 外部通信・外部アセットの読み込みなし。

## パフォーマンス考慮事項

- カチカチ音は最低間隔（約30ms）で間引き、`requestAnimationFrame` のフレーム内処理を軽く保つ。
- 音の生成はノードの生成・接続のみで、重い同期処理（バッファの再生成等）を毎フレーム行わない。
  ドラムロールのノイズバッファは開始時に1回だけ生成する。
- ミュート（初期状態）では `AudioContext` を生成せず、CPU・メモリを一切使わない。

## 将来の拡張性

- `RouletteSounds` インターフェースにより、音声ファイル実装（リッチ音源）への差し替えが
  SoundDirector の置き換えだけで可能（View・main は無改修）。
- 音量調整・ミュート保存を追加する場合は SoundDirector にゲイン設定と localStorage 連携を足すのみ。
