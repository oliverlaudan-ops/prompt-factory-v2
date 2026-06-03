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

# OpenSSL 1.1 für Prisma query engine (musl alpine)
RUN apk add --no-cache openssl libssl3

# Schema vor npm ci bereitstellen, weil postinstall prisma generate läuft
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "server.js"]
