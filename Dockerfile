# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-slim AS production

# Native build tools for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=builder /build/client/dist /app/client/dist

RUN mkdir -p /app/data/audio

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/adhdhelper.db
ENV AUDIO_PATH=/app/data/audio

EXPOSE 3000

CMD ["node", "index.js"]
