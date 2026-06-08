# Build stage
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# libssl + ca-certificates für Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Prisma schema brauchen wir VOR npm ci, weil postinstall prisma generate läuft
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Restlicher Source
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# libssl3 + ca-certificates für Prisma query engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Prisma client + binaries aus dem builder-Image übernehmen
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "server.js"]
