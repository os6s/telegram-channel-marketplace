# build
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN rm -rf dist
RUN npm run build   # فقط بناء الفرونت/السيرفر

# runtime
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle 2>/dev/null || true
COPY drizzle.config.ts ./drizzle.config.ts

# يشغّل المايغريشن على قاعدة Railway ثم يبدأ السيرفر
COPY <<'SH' /app/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail
npx drizzle-kit push
node dist/index.js
SH
RUN chmod +x /app/entrypoint.sh

EXPOSE 5000
CMD ["/app/entrypoint.sh"]