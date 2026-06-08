# Prompt Factory v2

> Self-hosted Multi-User Prompt-Bibliothek — Next.js 14, Prisma, NextAuth, Tailwind.

[🇬🇧 English version](README.md) · **Live:** <https://prompts.future-pulse.de>

---

## ⚡ Quick Start

```bash
git clone https://github.com/oliverlaudan-ops/prompt-factory-v2.git
cd prompt-factory-v2

cp .env.example .env
# .env editieren: mindestens NEXTAUTH_SECRET und ENCRYPTION_KEY setzen (s.u.)

docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

App: <http://localhost:3000>. Beim ersten Besuch registrieren, dann unter
**Einstellungen** den eigenen Ollama-Cloud-Key hinterlegen, um die
KI-Verfeinerung zu nutzen.

Die zwei Secrets generieren:
```bash
openssl rand -base64 48   # → NEXTAUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY (32 Bytes, 44 base64-Zeichen)
```

---

## Features

- 🔐 **Multi-User Auth** via NextAuth v5 (Email + Passwort, bcrypt)
- 📝 **Prompts verwalten** — Erstellen, Bearbeiten, Löschen mit Multi-User-Isolation
- ⭐ **Favoriten** — Prompts markieren, Sortierung nach Favoriten zuerst
- 🌍 **Public / Private** — Prompts als öffentlich markieren, sind dann auch ohne Login sichtbar
- 🧩 **Variablen-Templates** — `{{VARIABLE_NAME}}`-Pattern, Live-Preview beim Ausfüllen
- ✨ **KI-Verfeinerung** — Prompts mit Ollama Cloud per KI verbessern (verschlüsselter API-Key pro User, 5 Modelle, **A/B-Vergleichs-Modus** mit SSE-Streaming)
- 📋 **Prompt kopieren** — Ein-Klick in die Zwischenablage
- 🌙 **Dark Mode** — Toggle, mit `localStorage`-Persist und OS-Preference-Detection
- 🔒 **HTTPS** via Let's Encrypt (Auto-Renew)
- 🐳 **Docker-Compose** — App + Postgres, persistent

## Screenshots

> Lege Screenshots in `docs/screenshots/` ab und verlinke sie hier. Vorschläge:
> Dashboard, Prompt-Editor, A/B-Refinement-Ansicht, Settings (light + dark).

## 🧱 Stack

| Komponente | Tech |
|------------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript strict |
| Styling | Tailwind CSS (mit `darkMode: 'class'`) |
| Backend | Next.js API Routes (Node 20) |
| Database | PostgreSQL 16 (Alpine) |
| ORM | Prisma 5.22 |
| Auth | NextAuth v5 (beta) mit Credentials Provider + Prisma Adapter |
| AI-Refinement | Ollama Cloud (OpenAI-kompatible API, AES-256-GCM-Key-Encryption) |
| Deployment | Docker (Multi-Stage, `output: 'standalone'`) + Host-Nginx Reverse-Proxy + Let's Encrypt |

## 🏗️ Architektur

```
            ┌──────────────────────────────────────────────┐
            │                  Browser                      │
            └──────────────────────┬───────────────────────┘
                                   │ HTTPS (443)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         Host-Nginx (SSL-Termination)         │
            │   /etc/nginx/sites-available/prompts.conf    │
            └──────────────────────┬───────────────────────┘
                                   │ http://127.0.0.1:3000
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │   Docker: prompt-factory-v2_app_1  (Next.js 14)      │
       │   • Prisma Client                                       │
       │   • NextAuth v5 (JWT-Session-Strategie)                │
       │   • AES-256-GCM-Helper für Ollama-Keys                  │
       │   • SSE-Endpoint /api/prompts/refine (Streaming A/B)    │
       └──────────────────────┬────────────────────────────────┘
                              │ Prisma / TCP 5432
                              ▼
       ┌───────────────────────────────────────────────────────┐
       │   Docker: prompt-factory-v2_db_1  (Postgres 16)      │
       │   Volume: postgres_data                               │
       └───────────────────────────────────────────────────────┘
```

## 📦 Projektstruktur

```
src/
  app/                  # Next.js App Router
    api/                #   Backend-Endpoints
      auth/             #     signin + signup (mit CSRF-Origin-Check)
      prompts/          #     CRUD + favorite + refinements + refine (SSE)
      settings/         #     ollama (GET/PUT/DELETE) + test
    auth/               #   Sign-in / Sign-up Seiten
    prompts/            #   Prompt-Liste, Neu, Bearbeiten, Verwenden
    settings/           #   User-Settings-UI
  lib/                  # Geteilte Server-Side Helpers
    auth.ts             #   NextAuth v5 Config (Cookies gehärtet)
    crypto.ts           #   AES-256-GCM-Helper
    ollama.ts           #   Ollama-Cloud-Client (Streaming + A/B)
    prisma.ts           #   Prisma-Client-Singleton
    prompt-variables.ts #   {{VAR}}-Parser / Renderer
    rate-limit.ts       #   In-Memory Sliding-Window-Limiter
    __tests__/          #   Standalone tsx-Test-Scripts
prisma/
  schema.prisma         # User, Prompt, UserOllamaConfig, Refinement, Account, Session
  migrations/           # SQL-Migrationen
```

## 🚀 Produktion (VPS)

```bash
# 1. DNS A-Record der Domain auf VPS-IP zeigen lassen
# 2. Repo clonen und .env anlegen
git clone https://github.com/oliverlaudan-ops/prompt-factory-v2.git /opt/prompt-factory-v2
cd /opt/prompt-factory-v2
cp .env.example .env && nano .env

# 3. Container starten
docker compose up -d --build
docker compose exec app npx prisma migrate deploy

# 4. Host-Nginx-Vhost anlegen
sudo tee /etc/nginx/sites-available/prompts.example.com > /dev/null <<'EOF'
server {
    listen 80;
    server_name prompts.example.com;

    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE braucht diese, sonst buffert Nginx
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/prompts.example.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. HTTPS via Let's Encrypt
sudo certbot --nginx -d prompts.example.com --redirect
```

## Umgebungsvariablen

Details in [`.env.example`](.env.example). Kurzfassung:

```env
# Database
DATABASE_URL="postgresql://postgres:DEIN_PASS@db:5432/promptfactory?schema=public"

# NextAuth
NEXTAUTH_SECRET=        # openssl rand -base64 48
NEXTAUTH_URL=https://prompts.example.com

# Node
NODE_ENV=production
HOST=0.0.0.0            # in Docker zwingend 0.0.0.0, sonst bindet der Server nur auf Container-Loopback

# AES-Key für User-Ollama-Keys
ENCRYPTION_KEY=         # openssl rand -base64 32
```

> `NEXTAUTH_TRUST_HOST=true` ist in `src/lib/auth.ts` hart gesetzt (für Reverse-Proxy-Betrieb hinter Nginx). In `src/app/api/auth/signup/route.ts` validiert `NODE_ENV=production` zusätzlich den `Origin`-Header als CSRF-Schutz.

## ✨ KI-Verfeinerung (Ollama Cloud)

User hinterlegen in **Einstellungen** ihren eigenen Ollama-Cloud-API-Key. Beim
Bearbeiten eines Prompts steht der Button **„✨ Mit KI verbessern"** zur
Verfügung.

**Flow:**
1. User hinterlegt Key in Settings → wird AES-256-GCM-verschlüsselt in `UserOllamaConfig` gespeichert
2. Klick auf „Mit KI verbessern" → Server lädt Prompt + entschlüsselt Key
3. Server ruft `https://ollama.com/v1/chat/completions` mit dem gewählten Modell auf
4. Server streamt Deltas per SSE an den Browser (Token-für-Token-UI)
5. User sieht **zwei Varianten nebeneinander** (A/B-Modus) und wählt eine aus

**Verfügbare Modelle:** `minimax-m3:cloud`, `kimi-k2.5:cloud`, `qwen3-coder:cloud`,
`gpt-oss:120b-cloud`, `deepseek-v3.1:cloud` (in den Settings wählbar).

**Sicherheit:**
- Key wird niemals im Klartext ans Frontend oder in Logs zurückgegeben
- Rate-Limit: 20 Verfeinerungen / Stunde pro User
- Bei DB-Backup sind Keys ohne `ENCRYPTION_KEY` wertlos
- Verbindungs-Test-Button in Settings (5 Tests / 5 min)

**Datenschutz-Hinweis:** Beim Verfeinern wird dein Prompt an Ollama Cloud gesendet.
Prüfe deren Datenschutzbedingungen, falls deine Prompts sensible Daten enthalten.

## 🗃️ Datenmodell

Siehe [`prisma/schema.prisma`](prisma/schema.prisma). Die wichtigsten Modelle:

- `User` — `email`, `name?`, `password?` (bcrypt-Hash)
- `Prompt` — `userId`, `title`, `content` (unterstützt `{{VARIABLES}}`), `isFavorite`, `isPublic`
- `UserOllamaConfig` — 1:1 mit `User`, hält den verschlüsselten Ollama-Key
- `Refinement` — Historie der KI-Verfeinerungen pro Prompt (für die Diff-Ansicht)
- `Account` / `Session` — NextAuth-Standard

## 🛠️ Development

```bash
npm install                # führt auch `prisma generate` aus
npm run dev                # Next Dev-Server
npm run typecheck          # tsc --noEmit
npm test                   # alle Standalone-Tests
npm run lint               # next lint (eslint)
npm run db:reset           # ⚠ löscht und re-migriert die Dev-DB
```

**Neue API-Route hinzufügen?** Konventionen in [`CONTRIBUTING.md`](CONTRIBUTING.md)
(Auth-Check, Validierung, Error-Shape, Rate-Limit).

**Neuen Test hinzufügen?** `*.test.ts` in `src/lib/__tests__/` ablegen und im
`test`-Script in `package.json` eintragen. Bewusst ohne Jest/Vitest — die
hand-rolled Assert-Harness hat null Dependencies.

## Backup / Restore

V1 → V2 Import-Script liegt in `imports/import_v1.mjs`:

```bash
docker cp v1-backup.json prompt-factory-v2_app_1:/app/
docker cp imports/import_v1.mjs prompt-factory-v2_app_1:/app/
docker exec prompt-factory-v2_app_1 sh -c "cd /app && node import_v1.mjs v1-backup.json"
```

Idempotent (überspringt Prompts mit gleichem Titel), `--force` zum Überschreiben, `--dry-run` zum Testen.

## 📄 Lizenz

MIT — siehe [`LICENSE`](LICENSE).

## 🤝 Beitragen

PRs willkommen! Vorher [`CONTRIBUTING.md`](CONTRIBUTING.md) lesen. Bug-Reports
und Feature-Requests: GitHub-Issue öffnen.
