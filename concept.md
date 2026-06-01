少女キャラクター「IThieL」のチャットボット。
AIを利用。

## 概要

- ユーザーとキャラクターが、発話またはテキストで対話する。

## 機能

- Live2DやSpine的な表情・姿勢・口パクアニメーション
- キャンパス近くの昼ご飯を案内
- 時間割を案内
- キャンパス案内
  - 特に学祭のときに？
- 電車の時刻案内

## 実装

- どうやって実装するか決めかねている
  - Front, Back, AI, DB(会話履歴)
    - DB
      - 目的：会話履歴の分析、今後の応対の改善
      - SQLite?

### AI

- API利用?
- ローカルLLM?
- ChromeのBuilt in AI API?
  - ChromeのBuilt in AI APIは、まだ不安定だし、今後変わったときに対応が面倒
- **そもそもAIを使わない、すべてルールベースの応答?**
  - AIを使うとしても、よくある質問であればルールベースの応答をしたほうが安全かもしれない

### UI

- 縦画面を想定
- イティエルの下にテキストボックスを表示 (ノベルゲー的な)

## 開発フロー

1. まず、チームへのコンセプト共有を目的とし、フロントの見た目をつくる
   - Stitchで？
   - Pinterestで参考となる画像を探す？
2. テキスト入出力 (非音声) による、決まった応対の対話をできるようにする
3. テキスト入出力 (非音声) による、AIによる対話をできるようにする
4. Live2Dによるキャラクターアニメーションを表示する
5. イティエルの音声出力ができるようにする
6. 音声入力ができるようにする

## その他

- **AITuber系のプロジェクトが参考になりそう**
- yumさん、みずさわさんの関連でCoeFontがt2sに利用できるかも？

---

---

---

## Development Example (1) made with AI

### ディレクトリ構造

```
chatbot/
├─ public/
│   └─ live2d/
├─ src/
│   ├─ index.html
│   ├─ main.ts
│   ├─ live2d.ts
│   ├─ chat.ts
│   ├─ speech.ts
│   ├─ store.ts
│   └─ style.css
├─ server/
│   ├─ index.ts
│   ├─ db.ts
│   └─ config.ts
├─ .env
├─ tsconfig.json
├─ vite.config.ts
└─ package.json
```

### 主要ファイルの役割と相互関係

| ファイル            | 主な責務                                                                    | 参照先 / 呼び出し元                                                           |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **main.ts**         | アプリ起点：Live2D 初期化、UI イベント、音声認識・合成、チャットフロー制御  | `live2d.ts`, `chat.ts`, `speech.ts`, `store.ts` をインポート                  |
| **live2d.ts**       | Live2D SDK ラッパー：モデルロード、表情・口パク制御                         | `main.ts` から `initLive2D()`, `setExpression()`, `setMouthOpen()` を呼び出す |
| **chat.ts**         | AI API 呼び出し抽象化（OpenAI / Claude / ローカル LLM）                     | `main.ts` の `sendMessage()` 内で使用                                         |
| **speech.ts**       | `SpeechRecognition` と `SpeechSynthesis` のラッパー                         | `main.ts` の音声入力/出力ロジック                                             |
| **store.ts**        | 会話履歴の永続化（SQLite（バックエンド） ⇔ IndexedDB（フロント））          | `main.ts` が履歴取得・保存を行う                                              |
| **server/index.ts** | `/api/chat` エンドポイント：リクエスト受信 → 履歴取得 → LLM 呼び出し → 返答 | フロントの `chat.ts` が `fetch('/api/chat')` で叩く                           |
| **server/db.ts**    | SQLite ラッパー：`INSERT/SELECT` を提供                                     | `server/index.ts` が利用                                                      |

### 主な機能

- **縦画面ノベルゲーム風 UI** で、Live2D キャラクターと自然な対話を実現
- 音声入力（SpeechRecognition）と音声出力（SpeechSynthesis）を統合し、ハンズフリー体験を提供
- 会話履歴は **SQLite**（バックエンド）＋ **IndexedDB**（フロント）に永続化し、将来の分析・改善に利用

| カテゴリ         | 実装概要                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **Live2D**       | `@live2d/cubism-sdk` でモデル読み込み、`setExpression` / `setMouthOpen` で表情・口パク制御 |
| **チャット UI**  | 縦レイアウト、Canvas 上部にキャラ、下部にノベルゲーム風テキストボックス                    |
| **音声入力**     | `SpeechRecognition`（`startRecognition`）でユーザーの発話を文字列化                        |
| **音声出力**     | `SpeechSynthesis`（`speak`）で AI 返答を音声再生                                           |
| **AI 連携**      | `/api/chat`（Express） → OpenAI/Claude など外部 LLM、またはローカル LLM 呼び出し           |
| **会話履歴**     | バックエンドは SQLite、フロントは IndexedDB。履歴はプロンプトに組み込み一貫性を確保        |
| **表情ロジック** | 返答に含まれるキーワードで表情 (`happy`, `thinking`, `neutral`) を切替                     |
| **口パク**       | `setMouthOpen` にランダム値を与えて自然なリップシンクを実装                                |

### 技術選択根拠

- **Live2D Cubism SDK**: Web 用公式 SDK、表情・モーションの API が充実。
- **Web Speech API**: 標準ブラウザAPI、外部ライブラリ不要で音声入出力を実装可能。

### 今後の拡張候補

1.  **感情分析**：履歴から感情トーンを取得し、表情を自動調整。
2.  **マルチモーダル**：画像・地図表示をチャットに埋め込む（HTML スニペット）。
3.  **プラグインシステム**：天気、交通、イベント情報などを外部 API でプラグイン化。
4.  **会話履歴の永続化** → `server/db.ts` の SQLite が生成され、`GET /api/history` などエンドポイント拡張で閲覧可能。
