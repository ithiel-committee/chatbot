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

- マルチプロジェクト共有運用: 環境変数の切り替えにより、「iThiel Committee」（イティエル）や「C3」（ホログラム対話）など、用途や展示形態に応じた設定へ即座に切り替え可能
- 柔軟な定型文応答: 必要に応じて有効化可能な定型文自動応答（挨拶、キャンパス案内等に対する感情タグ付き即時応答）
- マルチモデル対応: 3D(VRM)および 2D(Live2D / PNGTuber)モデルに対応し、感情・モーション制御とリップシンクを実現
- マルチAIプロバイダー対応: OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, Groq, OpenRouter, LM Studio, Ollama, Dify, Custom API の最新LLMに対応
- 最新モデル対応: Google Gemini 3.8 Flash / 3.7 Flash, OpenAI GPT-4o / GPT-4o-mini 等に対応
- 音声合成(TTS)連携: VOICEVOX, AivisSpeech, Aivis Cloud API, Koeiromap, Google TTS, Style-Bert-VITS2, OpenAI TTS と連動
- 高速な開発環境: Turbopack・動的インポート・起動時バックグラウンドウォームアップによる高速ビルド

## 仕組み

- 言語: TypeScript
- フレームワーク: Next.js 15 (React 18.3)
- パッケージマネージャー: pnpm
- スタイリング: Tailwind CSS
- 3D / 2D描画: @pixiv/three-vrm, Pixi.js (Live2D Cubism SDK)
- 音声・リップシンク: Web Audio API
- 開発サーバー: Turbopack 高速開発サーバー + 起動時ウォームアップ (`scripts/dev-server.js`)

### 構造

```text
chatbot/
├── .github/
│   └── workflows/              - GitHub Actionsワークフロー定義
├── public/
│   ├── backgrounds/            - 背景画像アセット (bg.jpg 等)
│   ├── live2d/                 - Live2Dモデルアセット
│   └── vrm/                    - 3D VRMモデルアセット (ithiel.vrm 等)
├── scripts/
│   ├── dev-server.js           - Turbopack起動と自動ウォームアップを行う開発サーバースクリプト
│   └── print-startup-logo.js   - 起動ロゴ表示スクリプト
├── src/
│   ├── components/             - UIコンポーネント (チャット画面、設定モーダル等)
│   ├── features/               - 各種機能モジュール
│   │   ├── chat/               - 対話ロジック・定型文応答処理
│   │   ├── constants/          - AIモデル定義(aiModels.ts)・各種定数
│   │   ├── emoteController/    - 表情・感情制御
│   │   ├── lipSync/            - 音声認識と連動したリップシンク
│   │   ├── messages/           - メッセージ送受信・音声合成(TTS)制御
│   │   ├── stores/             - Zustand状態管理 (settings, home 等)
│   │   └── vrmViewer/          - 3Dモデルビューア制御
│   ├── hooks/                  - カスタムReactフック
│   ├── lib/                    - APIクライアント・ユーティリティライブラリ
│   ├── pages/                  - Next.jsルーティング・APIエンドポイント (/api/ai/vercel 等)
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

新規環境で本プロジェクトを動かすための手順です。

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

`.env.local` をエディタで開き、利用する AI サービス等の設定を行います。

| 設定項目                               | 説明                                                                 | 既定値・設定例                  |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_SITE_NAME`                | アプリケーション名                                                   | `iThieL Chatbot` / `C3 Chatbot` |
| `NEXT_PUBLIC_CHARACTER_NAME`           | キャラクター表示名                                                   | `イティエル` / `アシスタント`   |
| `NEXT_PUBLIC_SELECTED_VRM_PATH`        | 初期表示のVRMモデルパス                                              | `/vrm/ithiel.vrm`               |
| `NEXT_PUBLIC_SYSTEM_PROMPT`            | システムプロンプト (人格・役割設定)                                  | (用途に合わせたプロンプト)      |
| `NEXT_PUBLIC_ENABLE_CANNED_RESPONSES`  | 定型文応答の有効化 (`true` / `false`)                                | `false`                         |
| `NEXT_PUBLIC_SELECT_AI_SERVICE`        | 利用するAIプロバイダー (`google`, `openai`, `ollama` 等)             | `google`                        |
| `NEXT_PUBLIC_SELECT_AI_MODEL`          | 利用するAIモデル名                                                   | `gemini-3.8-flash`              |
| `GEMINI_API_KEY`                       | Google Gemini API キー                                               | `AIza...`                       |
| `OPENAI_API_KEY`                       | OpenAI API キー                                                      | `sk-...`                        |
| `AITUBERKIT_SERVER_SECRET_ACCESS_MODE` | サーバー側APIキーの利用制限 (`unprotected` でブラウザ側の入力不要に) | `unprotected`                   |
| `NEXT_PUBLIC_SELECT_LANGUAGE`          | 初期表示言語 (`ja` / `en`)                                           | `ja`                            |
| `NEXT_PUBLIC_BACKGROUND_IMAGE_PATH`    | 初期表示の背景画像パス                                               | `/backgrounds/bg.jpg`           |
| `NEXT_PUBLIC_VOICEVOX_SERVER_URL`      | VOICEVOX サーバーのURL                                               | `http://localhost:50021`        |

※ `.env.example` の末尾に「iThiel Committee（イティエル）」および「C3（ホログラム対話）」のプリセット設定例がコメント形式で記載されています。必要に応じてコピー＆ペーストしてご利用いただけます。
※ `AITUBERKIT_SERVER_SECRET_ACCESS_MODE="unprotected"` を指定することで、ブラウザの設定画面でAPIキーを毎回入力しなくても、`.env.local` に記載したAPIキーがサーバー側で自動的に利用されます。

### 5. 開発サーバーの起動

開発サーバーを起動します。Turbopack と起動時ウォームアップにより高速に立ち上がります。

```bash
pnpm dev
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 音声合成・AIサービスの準備

### VOICEVOX (推奨・無料)

1. [VOICEVOX 公式サイト](https://voicevox.hiroshiba.jp/) からアプリをダウンロードして起動します。
2. アプリを起動した状態で本Webアプリを開くと、ローカル連携 (http://localhost:50021) でキャラクターが発話します。

### AivisSpeech / Style-Bert-VITS2

ローカルで各音声合成サーバーを起動し、設定画面または `.env.local` でエンドポイントURLを指定することで連携可能です。

### 各種LLM (クラウドAPI)

`.env.local` に各サービスの API キーを記述するか、設定画面の歯車アイコンから API キーを入力することで利用可能です。
Google Gemini を利用する場合は `gemini-3.8-flash` が推奨モデルです。

## コマンド一覧

| コマンド                 | 実行内容                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `pnpm install`           | 依存パッケージのインストール                                               |
| `pnpm dev`               | 高速開発サーバーの起動 (Turbopack + ウォームアップ、http://localhost:3000) |
| `pnpm run dev:webpack`   | 通常の開発サーバー起動 (Webpack)                                           |
| `pnpm run dev-https`     | HTTPS対応開発サーバーの起動                                                |
| `pnpm run desktop`       | 開発サーバーとElectronデスクトップアプリを同時起動                         |
| `pnpm build`             | 本番用ビルドの生成                                                         |
| `pnpm start`             | 本番サーバーの起動                                                         |
| `pnpm run lint`          | ESLint による静的解析                                                      |
| `pnpm run lint:fix`      | ESLint によるコード自動修正                                                |
| `pnpm run format`        | Prettier によるコード整形                                                  |
| `pnpm test`              | Jest による単体テストの実行                                                |
| `pnpm run test:watch`    | 単体テストのウォッチモード実行                                             |
| `pnpm run test:coverage` | カバレッジ付き単体テストの実行                                             |
| `pnpm run test:e2e`      | Playwright による E2E テストの実行                                         |

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
