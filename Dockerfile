# ---------- build stage ----------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN rm -rf dist \
 && npm run build \
 && npm run db:generate

# ---------- runtime stage ----------
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

COPY <<'SH' /app/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail
npx drizzle-kit push   # يطبق المايغريشن
node dist/index.js     # يشغل السيرفر
SH
RUN chmod +x /app/entrypoint.sh

EXPOSE 5000
CMD ["/app/entrypoint.sh"]