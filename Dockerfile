# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma schema brauchen wir VOR npm ci, weil postinstall prisma generate läuft
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Restlicher Source
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# libssl3 für Prisma query engine (musl alpine + OpenSSL 3)
RUN apk add --no-cache libssl3

# Wir setzen PRISMA_QUERY_ENGINE_BINARY explizit, damit Prisma die richtige
# Binary lädt (linux-musl-openssl-3.0.x). Ohne das versucht Prisma 5.22
# die `linux-musl`-Variante zu laden, die libssl.so.1.1 braucht — und
# scheitert mit "Error loading shared library libssl.so.1.1".
ENV PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

# Prisma client + binaries aus dem builder-Image übernehmen
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "server.js"]
