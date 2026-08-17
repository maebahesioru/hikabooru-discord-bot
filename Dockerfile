# hikabooru Discord bot — Bun runtime
FROM oven/bun:1.3

WORKDIR /app

# 依存関係
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# ソース & モデル
COPY src ./src
COPY tsconfig.json ./
COPY data ./data

# 起動
CMD ["bun", "run", "src/index.ts"]
