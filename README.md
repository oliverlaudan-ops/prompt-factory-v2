# Prompt Factory v2

> Self-hosted Multi-User Prompt-Bibliothek — Next.js 14, Prisma, NextAuth, Tailwind.

Live: **[prompts.future-pulse.de](https://prompts.future-pulse.de)**

## Features

- 🔐 **Multi-User Auth** via NextAuth v5 (Email + Passwort, bcrypt)
- 📝 **Prompts verwalten** — Erstellen, Bearbeiten, Löschen mit Multi-User-Isolation
- ⭐ **Favoriten** — Prompts markieren, Sortierung nach Favoriten zuerst
- 🌍 **Public / Private** — Prompts als öffentlich markieren, sind dann auch ohne Login sichtbar
- 🧩 **Variablen-Templates** — `{{VARIABLE_NAME}}` Pattern, Live-Preview beim Ausfüllen
- 📋 **Prompt kopieren** — Ein-Klick in die Zwischenablage
- 🌙 **Dark Mode** — Toggle, mit `localStorage`-Persist und OS-Preference-Detection
- 🔒 **HTTPS** via Let's Encrypt (Auto-Renew)
- 🐳 **Docker-Compose** — App + Postgres, persistent

## Stack

| Komponente | Tech |
|------------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS (mit `darkMode: 'class'`) |
| Backend | Next.js API Routes |
| Database | PostgreSQL 16 (Alpine) |
| ORM | Prisma 5.22 |
| Auth | NextAuth v5 (beta) mit Credentials Provider + Prisma Adapter |
| Deployment | Docker + Host-Nginx Reverse-Proxy + Let's Encrypt |

## Setup

### Voraussetzungen

- Docker + Docker Compose
- Optional: Nginx (für Reverse-Proxy) und Certbot (für HTTPS)

### Lokal

```bash
git clone https://github.com/oliverlaudan-ops/prompt-factory-v2.git
cd prompt-factory-v2

# .env aus Template erstellen
cp .env.example .env
# NEXTAUTH_SECRET generieren: openssl rand -base64 48
# Passwort für Postgres setzen

# Container starten
docker-compose up -d --build

# Migrationen deployen
docker-compose exec app npx prisma migrate deploy

# App läuft auf http://localhost:3000
```

### Produktion (VPS)

```bash
# 1. DNS A-Record der Domain auf VPS-IP zeigen lassen
# 2. Repo clonen, .env anlegen
# 3. Container starten
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy

# 4. Host-Nginx vhost anlegen (siehe unten)
# 5. SSL mit Certbot
certbot --nginx -d prompts.example.com
```

**Nginx vhost** (`/etc/nginx/sites-available/prompts.example.com`):

```nginx
server {
    listen 80;
    server_name prompts.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**SSL**:
```bash
ln -s /etc/nginx/sites-available/prompts.example.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d prompts.example.com --redirect
```

## Umgebungsvariablen

`.env`:

```env
# Database (für den Container: 'db' ist der Service-Name in docker-compose)
DATABASE_URL=postgresql://postgres:DEIN_PASS@db:5432/promptfactory?schema=public
DB_PASSWORD=DEIN_PASS

# NextAuth
NEXTAUTH_SECRET=           # 64-Zeichen Random-String
NEXTAUTH_URL=https://prompts.example.com
NEXTAUTH_TRUST_HOST=true

# Node
NODE_ENV=production
```

`NEXTAUTH_SECRET` generieren: `openssl rand -base64 48 | head -c 64`

## Architektur

```
Browser
  ↓ HTTPS
Host-Nginx (Port 443, SSL-Termination)
  ↓ http://127.0.0.1:3000
Docker Container: prompt-factory-v2_app_1 (Next.js standalone)
  ↓ Prisma Client
Docker Container: prompt-factory-v2_db_1 (PostgreSQL 16)
```

Der `app`-Container baut Next.js im Multi-Stage-Build (`node:20-alpine`),
nutzt `output: 'standalone'` für minimale Image-Größe. Der `db`-Container
hält die Daten in einem named Volume `postgres_data`.

## Projektstruktur

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts    # NextAuth Handler
│   │   ├── auth/signup/route.ts           # POST /api/auth/signup
│   │   └── prompts/
│   │       ├── route.ts                   # GET (list) / POST (create)
│   │       └── [id]/
│   │           ├── route.ts               # GET / PUT / DELETE
│   │           └── favorite/route.ts      # PATCH (toggle favorite)
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   └── signup/page.tsx
│   ├── prompts/
│   │   ├── new/page.tsx                   # Create form
│   │   └── [id]/
│   │       ├── edit/page.tsx
│   │       └── use/page.tsx               # Variable-Form + Live-Preview
│   ├── globals.css
│   ├── layout.tsx                         # RootLayout + Theme-Script
│   ├── page.tsx                           # Homepage mit Prompt-Cards
│   ├── theme-toggle.tsx                   # 🌙/☀️ Client-Component
│   ├── variable-helper.tsx                # Chip-UI + Insert-Button
│   └── lib-button.tsx                     # Copy / Favorite / Delete / SignOut
├── lib/
│   ├── auth.ts                            # NextAuth Config
│   ├── prisma.ts                          # Prisma Client Singleton
│   └── prompt-variables.ts                # {{VAR}} Detection + Rendering
prisma/
├── schema.prisma
└── migrations/
```

## Datenmodell

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String?  // bcrypt hash
  prompts   Prompt[]
  // NextAuth standard fields...
}

model Prompt {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?
  content     String   // @db.Text, supports {{VARIABLES}}
  category    String?
  tags        String?
  isFavorite  Boolean  @default(false)
  isPublic    Boolean  @default(false)
  user        User     @relation(...)
  @@index([userId])
  @@index([category])
}
```

## Backup / Restore

V1 → V2 Import liegt in `imports/import_v1.mjs`. Nutzung:

```bash
# JSON nach /opt/prompt-factory-v2/imports/v1-backup.json legen
docker cp v1-backup.json prompt-factory-v2_app_1:/app/
docker cp import_v1.mjs prompt-factory-v2_app_1:/app/
docker exec prompt-factory-v2_app_1 sh -c "cd /app && node import_v1.mjs v1-backup.json"
```

Idempotent (überspringt Prompts mit gleichem Titel), `--force` zum Überschreiben, `--dry-run` zum Testen.

## Development

```bash
# Type-Check
npx tsc --noEmit

# Tests
npx tsx src/lib/__tests__/prompt-variables.test.ts

# Lokal dev (ohne Docker)
npm install
DATABASE_URL=postgresql://... npm run dev
```

## License

MIT
