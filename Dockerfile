# ベースイメージとしてNode.js（LTSバージョン）を使用
FROM node:18

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルをコピー
COPY package.json package-lock.json* ./

# 依存関係をインストール
RUN npm install

# プロジェクトの全ファイルをコピー
COPY . .

# .envファイルはgitignoreされているため、Dockerビルド時に含めない
# 環境変数はdocker run時に渡す（例：-e DISCORD_TOKEN=xxx）

# アプリケーションの起動コマンド
CMD ["node", "index.js"]