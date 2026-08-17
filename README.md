# iThieL Chatbot

中央大学国際情報学部(iTL)のAIキャラクター「イティエル」対話型Webアプリケーション。

## 概要

iThieL Chatbot は、中央大学国際情報学部(iTL)のAIキャラクター「イティエル」とリアルタイムに対話・相談ができるWebアプリケーションです。

オープンソースの [AITuberKit](https://github.com/tegnike/aituber-kit) をベースに、iTL向けの独自機能や応答チューニングを追加して開発されています。

### 主な特徴

- iTL特化の定型文自動応答: 挨拶、時間割、市ヶ谷田町キャンパス案内、講義・勉強に関する質問に対して、感情タグ(表情変化)と連動した高速な自動応答を提供
- マルチモデル対応: 3D(VRM)および 2D(Live2D / PNGTuber)モデルに対応し、感情・モーション制御とリップシンクを実現
- マルチAIプロバイダー対応: OpenAI, Anthropic Claude, Google Gemini 等の最新LLMに対応
- 音声合成(TTS)連携: VOICEVOX, Style-Bert-VITS2, OpenAI TTS 等のエンジンと連動

## 仕組み

- 言語: TypeScript
- フレームワーク: Next.js (React 19)
- パッケージマネージャー: pnpm
- スタイリング: Tailwind CSS
- 3D / 2D描画: @pixiv/three-vrm, Pixi.js (Live2D Cubism SDK)
- 音声・リップシンク: Web Audio API

### 構造

```text
chatbot/
├── .github/
│   └── workflows/              - GitHub Actionsワークフロー定義
├── public/
│   ├── live2d/                 - Live2Dモデルアセット
│   └── vrm/                    - 3D VRMモデルアセット
├── src/
│   ├── components/             - UIコンポーネント
│   ├── features/               - 各種機能モジュール
│   │   ├── chat/               - 対話ロジック・定型文応答処理
│   │   ├── emoteController/    - 表情・感情制御
│   │   ├── lipSync/            - 音声認識と連動したリップシンク
│   │   ├── messages/           - メッセージ送受信・音声合成(TTS)制御
│   │   └── vrmViewer/          - 3Dモデルビューア制御
│   ├── hooks/                  - カスタムReactフック
│   ├── pages/                  - Next.jsルーティング・APIエンドポイント
│   ├── styles/                 - グローバルスタイル定義
│   └── types/                  - TypeScript型定義
├── tests/
│   └── e2e/                    - PlaywrightによるE2Eテスト
├── eslint.config.mjs
├── jest.config.js
├── package.json
├── playwright.config.ts
└── README.md
```

## 実行方法

| コマンド | 実行内容 |
| -- | -- |
| `pnpm install` | 依存パッケージのインストール |
| `pnpm dev` | 開発サーバーの起動 (http://localhost:3000) |
| `pnpm build` | 本番用ビルドの生成 |
| `pnpm start` | 本番サーバーの起動 |
| `pnpm run lint` | ESLint による静的解析 |
| `pnpm run lint:fix` | ESLint による自動修正 |
| `pnpm format` | Prettier によるコード整形 |
| `pnpm test` | Jest による単体テストの実行 |
| `pnpm run test:coverage` | カバレッジ付き単体テストの実行 |
| `pnpm run test:e2e` | Playwright による E2E テストの実行 |

## クレジット・ライセンス

### 謝辞

本アプリケーションは、[tegnike/aituber-kit](https://github.com/tegnike/aituber-kit)(作者: tegnike 氏)をベースにして構築されています。素晴らしいオープンソースソフトウェアを提供してくださっている作者様および貢献者の皆様に深く感謝いたします。

### ライセンス

- ベースコード(AITuberKit)のライセンス規定に基づき、`LICENSE` ファイル(AITuberKit Custom License)を保持しています。
- 本リポジトリは部活動・学内プロジェクト等の非営利目的で運用・改変されています。
