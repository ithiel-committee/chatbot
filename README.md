# iThieL Chatbot

<p align="center">
  <strong>中央大学国際情報学部（iTL） AIキャラクター「イティエル」対話型Webアプリケーション</strong>
</p>

<p align="center">
  <img alt="Project: iThieL Chatbot" src="https://img.shields.io/badge/Project-iThieL--Chatbot-blue">
  <img alt="Based on: AITuberKit" src="https://img.shields.io/badge/Based%20on-AITuberKit-orange">
  <img alt="License: Custom Non-Commercial" src="https://img.shields.io/badge/License-Custom%20Non--Commercial-green">
</p>

---

## 概要

**iThieL Chatbot** は、中央大学国際情報学部（iTL）のAIキャラクター「イティエル」とリアルタイムに対話・相談ができるWebアプリケーションです。

オープンソースのAIキャラクター構築ツールキットである [AITuberKit](https://github.com/tegnike/aituber-kit) をベースに、iTL向けの独自機能や応答チューニングを追加して開発されています。

### 主な特徴・独自機能

- 🏫 **iTL特化の定型文自動応答**: 挨拶、時間割、市ヶ谷田町キャンパス案内、講義・勉強に関する質問に対して、感情タグ（表情変化）と連動した高速な自動応答を提供。
- 🎭 **マルチモデル対応**: 3D（VRM）および 2D（Live2D / PNGTuber）モデルに対応し、スムーズな感情・モーション制御とリップシンクを実現。
- 🧠 **マルチAIプロバイダー対応**: OpenAI, Anthropic Claude, Google Gemini 等の最新LLMに対応し、用途に応じて柔軟に切り替え可能。
- 🔊 **多言語・多音声TTS対応**: VOICEVOX や Style-Bert-VITS2、OpenAI TTS などの音声合成エンジンと連動。

---

## クイックスタート

### 動作環境
- **Node.js**: 24.x
- **パッケージマネージャー**: `pnpm` (推奨) または `npm`

### セットアップ＆起動手順

1. **依存パッケージのインストール**
   ```bash
   pnpm install
   ```

2. **環境変数の設定**
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` を編集し、利用する AI サービス等の API キー（`OPENAI_API_KEY` や `GEMINI_API_KEY` 等）を設定します。

3. **開発サーバーの起動**
   ```bash
   pnpm dev
   ```
   起動後、ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスします。

---

## 開発ガイドライン

### 主要コマンド

```bash
pnpm dev           # 開発サーバーの起動 (http://localhost:3000)
pnpm build         # 本番用ビルド
pnpm start         # ビルド成果物で本番サーバーを起動
pnpm test          # Jestテストを実行
pnpm lint:fix      # ESLint自動修正
pnpm format        # Prettierフォーマット適用
```

---

## クレジット・ライセンス

### 謝辞
本アプリケーションは、[tegnike/aituber-kit](https://github.com/tegnike/aituber-kit)（作者: tegnike 氏）をベースにして構築されています。素晴らしいオープンソースソフトウェアを提供してくださっている作者様および貢献者の皆様に深く感謝いたします。

### ライセンス
- ベースコード（AITuberKit）のライセンス規定に基づき、`LICENSE` ファイル（AITuberKit Custom License）をそのまま保持しています。
- 本リポジトリは部活動・学内プロジェクト等の**非営利目的**で運用・改変されています。
