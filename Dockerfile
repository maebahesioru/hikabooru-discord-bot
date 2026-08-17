# hikabooru Discord bot — Bun runtime (自己完結型: ビルド時にGitHubから取得)
FROM oven/bun:1.3

WORKDIR /app

# リポジトリをクローン（Docker build context は空なのでGitHubから取得）
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --depth 1 --branch main https://github.com/maebahesioru/hikabooru-discord-bot.git /app \
    && rm -rf /app/.git

# 依存関係インストール
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# 起動
CMD ["bun", "run", "src/index.ts"]
