# iThieL Chatbot

中央大学国際情報学部(iTL)のAIキャラクター「イティエル」対話型Webアプリケーション。

## 目次

1. [概要](#概要)
2. [仕組み](#仕組み)
3. [セットアップ手順](#セットアップ手順)
4. [音声合成・AIサービスの準備](#音声合成aiサービスの準備)
5. [コマンド一覧](#コマンド一覧)
6. [かんたん起動・Docker実行](#かんたん起動docker実行)
7. [クレジット・ライセンス](#クレジットライセンス)

## 概要

iThieL Chatbot は、中央大学国際情報学部(iTL)のAIキャラクター「イティエル」とリアルタイムに対話・相談ができるWebアプリケーションです。

オープンソースのAIキャラクターツールキットである [AITuberKit](https://github.com/tegnike/aituber-kit) をベースに、iTL向けの独自機能や応答チューニングを追加して開発されています。

### 主な特徴

- iTL特化の定型文自動応答: 挨拶、時間割、市ヶ谷田町キャンパス案内、講義・勉強に関する質問に対して、感情タグ(表情変化)と連動した高速な自動応答を提供
- マルチモデル対応: 3D(VRM)および 2D(Live2D / PNGTuber)モデルに対応し、感情・モーション制御とリップシンクを実現
- マルチAIプロバイダー対応: OpenAI, Anthropic Claude, Google Gemini, Groq, Dify 等の最新LLMに対応
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
│   ├── backgrounds/            - 背景画像アセット (bg.jpg 等)
│   ├── live2d/                 - Live2Dモデルアセット
│   └── vrm/                    - 3D VRMモデルアセット (ithiel.vrm 等)
├── src/
│   ├── components/             - UIコンポーネント
│   ├── features/               - 各種機能モジュール
│   │   ├── chat/               - 対話ロジック・定型文応答処理
│   │   ├── emoteController/    - 表情・感情制御
│   │   ├── lipSync/            - 音声認識と連動したリップシンク
│   │   ├── messages/           - メッセージ送受信・音声合成(TTS)制御
│   │   ├── stores/             - Zustand状態管理 (settings, home 等)
│   │   └── vrmViewer/          - 3Dモデルビューア制御
│   ├── hooks/                  - カスタムReactフック
│   ├── pages/                  - Next.jsルーティング・APIエンドポイント
│   ├── styles/                 - グローバルスタイル定義
│   └── types/                  - TypeScript型定義
├── tests/
│   └── e2e/                    - PlaywrightによるE2Eテスト
├── .env.example                - 環境変数テンプレート
├── eslint.config.mjs           - ESLint設定
├── jest.config.js              - Jest単体テスト設定
├── package.json                - プロジェクト構成・依存関係定義
├── playwright.config.ts        - Playwright設定
└── README.md
```

## セットアップ手順

新規環境で本プロジェクトを動かすための詳細な手順です。

### 1. 前提条件の確認

以下のツールがインストールされている必要があります。

- **Node.js**: v22.13 以上 (v24.x 推奨)
- **pnpm**: v10.x 以上 (`npm install -g pnpm` または `corepack enable` で導入)
- **Git**

Linux (Ubuntu / Debian / WSL) 環境で動作させる場合は、キャンバス描画の依存ライブラリを事前にインストールしてください。

```bash
sudo apt-get update && sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### 2. リポジトリの取得

リポジトリをクローンし、プロジェクトディレクトリに移動します。

```bash
git clone https://github.com/ithiel-committee/chatbot.git
cd chatbot
```

### 3. 依存パッケージのインストール

`pnpm` を使用して依存関係をインストールします。

```bash
pnpm install
```

### 4. 環境変数の設定

`.env.example` をコピーしてローカル用の環境変数ファイル `.env.local` を作成します。

```bash
cp .env.example .env.local
```

`.env.local` をエディタで開き、利用する AI サービス等の API キーを設定します。

| 設定項目                            | 説明                       | 既定値・設定例           |
| ----------------------------------- | -------------------------- | ------------------------ |
| `OPENAI_API_KEY`                    | OpenAI API キー            | `sk-...`                 |
| `GEMINI_API_KEY`                    | Google Gemini API キー     | `AIza...`                |
| `ANTHROPIC_API_KEY`                 | Anthropic Claude API キー  | `sk-ant-...`             |
| `NEXT_PUBLIC_SELECT_LANGUAGE`       | 初期表示言語 (`ja` / `en`) | `ja`                     |
| `NEXT_PUBLIC_SELECTED_VRM_PATH`     | 初期表示のVRMモデルパス    | `/vrm/ithiel.vrm`        |
| `NEXT_PUBLIC_BACKGROUND_IMAGE_PATH` | 初期表示の背景画像パス     | `/backgrounds/bg.jpg`    |
| `NEXT_PUBLIC_VOICEVOX_SERVER_URL`   | VOICEVOX サーバーのURL     | `http://localhost:50021` |

※ ブラウザの設定画面から入力した API キーやモデル選択は、ブラウザのローカルストレージに優先保存されます。

### 5. 開発サーバーの起動

開発サーバーを起動します。

```bash
pnpm dev
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 音声合成・AIサービスの準備

### VOICEVOX (推奨・無料)

1. [VOICEVOX 公式サイト](https://voicevox.hiroshiba.jp/) からアプリをダウンロードして起動します。
2. アプリを起動した状態で本Webアプリを開くと、ローカル連携 (http://localhost:50021) でキャラクターが発話します。

### Style-Bert-VITS2 / AivisSpeech

ローカルで各音声合成サーバーを起動し、設定画面または `.env.local` でエンドポイントURLを指定することで連携可能です。

### 各種LLM (クラウドAPI)

設定画面の歯車アイコンから、利用したいプロバイダー (OpenAI, Gemini, Claude, Groq 等) の API キーを入力することで即座に利用可能になります。

## コマンド一覧

| コマンド                 | 実行内容                                   |
| ------------------------ | ------------------------------------------ |
| `pnpm install`           | 依存パッケージのインストール               |
| `pnpm dev`               | 開発サーバーの起動 (http://localhost:3000) |
| `pnpm build`             | 本番用ビルドの生成                         |
| `pnpm start`             | 本番サーバーの起動                         |
| `pnpm run lint`          | ESLint による静的解析                      |
| `pnpm run lint:fix`      | ESLint によるコード自動修正                |
| `pnpm run format`        | Prettier によるコード整形                  |
| `pnpm test`              | Jest による単体テストの実行                |
| `pnpm run test:coverage` | カバレッジ付き単体テストの実行             |
| `pnpm run test:e2e`      | Playwright による E2E テストの実行         |

## かんたん起動・Docker実行

### 起動スクリプト

初回セットアップ完了後は、同梱の起動スクリプトを利用してワンクリックで起動できます。

- **Windows**: `LAUNCH.bat` を実行
- **macOS / Linux**: `LAUNCH.command` を実行 (実行権限がない場合は `chmod +x LAUNCH.command` を実行)

### Docker Compose

Docker 環境がインストールされている場合、コンテナとして起動することも可能です。

```bash
# 起動
docker compose up -d

# 停止
docker compose down
```

起動後、[http://localhost:3000](http://localhost:3000) にアクセスします。

## クレジット・ライセンス

### 謝辞

本アプリケーションは、[tegnike/aituber-kit](https://github.com/tegnike/aituber-kit)(作者: tegnike 氏)をベースにして構築されています。素晴らしいオープンソースソフトウェアを提供してくださっている作者様および貢献者の皆様に深く感謝いたします。

### ライセンス

- ベースコード(AITuberKit)のライセンス規定に基づき、`LICENSE` ファイル(AITuberKit Custom License)を保持しています。
- 本リポジトリはサークル活動・学内プロジェクト等の非営利目的で運用・改変されています。
