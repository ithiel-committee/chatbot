# iThieL Chatbot

中央大学国際情報学部のマスコットキャラクター「iThieL (イティエル)」とブラウザ上で対話ができる3Dキャラクターチャットボット。

Webサイト: https://ithiel-committee.github.io/chatbot/

## 概要

-

## 仕組み

- 言語: JavaScript
- 3Dレンダリング: Three.js + @pixiv/three-vrm
- ビルドツール: Vite
- パッケージマネージャー: pnpm

### 特徴

- 対話用のシナリオデータは外部JSONから非同期で動的にロードされます。
- タイピングアニメーションや点滅する入力カーソルなど、ノベルゲーム風のインターフェースを手前に重ねて実装しています。

### 構造

```text
chatbot/
├── index.html
├── package.json
├── pnpm-lock.yaml
├── vite.config.js           - Viteのビルド設定 (ベースパス指定)
├── .gitignore
├── readme.md
├── main.js                  - 3Dモデルのレンダリング、表情・モーションの更新、および対話UI制御
├── research_notes.md        - AITuber開発に関する技術調査ノート
├── assets/
│   ├── bg.jpg               - 背景画像
│   └── qa_pairs.json        - 対話シナリオ (キーワード、応答テキスト、感情定義)
└── 3dmodel/
    └── ithiel.vrm           - iThieLの3Dアバターモデル
```

## 実行方法

| コマンド       | 実行内容                                               |
| -------------- | ------------------------------------------------------ |
| `pnpm install` | パッケージのインストール                               |
| `pnpm dev`     | 開発サーバーの起動 (Vite)                              |
| `pnpm build`   | 本番用の静的ファイルビルド                             |
| `pnpm deploy`  | 本番ビルドを実行し、GitHub Pages (gh-pages) へデプロイ |

## 対話データの更新・アセットの追加について

- **会話パターンの変更**: `assets/qa_pairs.json` の配列に新しい会話オブジェクトを追加・編集するだけです。
  ```json
  {
    "keywords": ["こんにちは", "ハロー"],
    "reply": "こんにちは！ 何かご用ですか？",
    "emotion": "happy"
  }
  ```
