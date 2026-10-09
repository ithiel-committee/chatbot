# ベースイメージとしてNode.js 24を使用
FROM node:24

# pnpmを有効化
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# 必要なシステムライブラリをインストール
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpnpm-lock.yamlをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係をインストール
RUN pnpm install --frozen-lockfile

# アプリケーションのソースコードをコピー
COPY . .

# 3000番ポートを公開
EXPOSE 3000

# 開発モードでアプリケーションを起動
CMD ["pnpm", "dev"]
