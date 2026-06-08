# Prompt Factory v2

> Self-hosted multi-user prompt library — Next.js 14, Prisma, NextAuth, Tailwind.

[🇩🇪 Deutsche Anleitung](README.de.md) · **Live demo:** <https://prompts.future-pulse.de>

---

## ⚡ Quick Start

```bash
git clone https://github.com/oliverlaudan-ops/prompt-factory-v2.git
cd prompt-factory-v2

cp .env.example .env
# Edit .env: at minimum set NEXTAUTH_SECRET and ENCRYPTION_KEY (see below)

docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

App: <http://localhost:3000>. Sign up on first visit, then head to **Settings** to add your Ollama Cloud key for AI refinement.

Generate the two secrets:
```bash
openssl rand -base64 48   # → NEXTAUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY (32 bytes, 44 base64 chars)
```

---

## ✨ Features

- 🔐 **Multi-user auth** — NextAuth v5, email + password, bcrypt
- 📝 **Prompt CRUD** — multi-user isolation by `userId`
- ⭐ **Favourites** — toggle, sorted first
- 🌍 **Public / private** — public prompts visible without login
- 🧩 **Variable templates** — `{{VARIABLE_NAME}}` with live preview
- ✨ **AI refinement** — Ollama Cloud, 5 curated models, **A/B comparison mode** with SSE streaming
- 📋 **One-click copy** to clipboard
- 🌙 **Dark mode** — class-based, localStorage-persistent, OS-preference detection
- 🔒 **HTTPS** via Let's Encrypt (auto-renew)
- 🐳 **Docker Compose** — app + Postgres, persistent volume

## Screenshots

> Drop screenshots into `docs/screenshots/` and reference them here. Suggested shots:
> dashboard, prompt editor, refinement A/B view, settings page (light + dark).

## 🧱 Stack

| Layer       | Tech |
|-------------|------|
| Frontend    | Next.js 14 (App Router), React 18, TypeScript strict |
| Styling     | Tailwind CSS (`darkMode: 'class'`) |
| Backend     | Next.js API Routes (Node 20) |
| Database    | PostgreSQL 16 (Alpine) |
| ORM         | Prisma 5.22 |
| Auth        | NextAuth v5 (beta) — Credentials Provider + Prisma Adapter |
| AI          | Ollama Cloud (OpenAI-compatible), per-user encrypted API key (AES-256-GCM) |
| Deployment  | Docker (multi-stage, `output: 'standalone'`) + host-Nginx reverse proxy + Let's Encrypt |

## 🏗️ Architecture

```
            ┌──────────────────────────────────────────────┐
            │                  Browser                      │
            └──────────────────────┬───────────────────────┘
                                   │ HTTPS (443)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │         Host-Nginx (SSL termination)          │
            │   /etc/nginx/sites-available/prompts.conf    │
            └──────────────────────┬───────────────────────┘
                                   │ http://127.0.0.1:3000
                                   ▼
       ┌───────────────────────────────────────────────────────┐
       │   Docker: prompt-factory-v2_app_1  (Next.js 14)      │
       │   • Prisma Client                                       │
       │   • NextAuth v5 (JWT session strategy)                  │
       │   • AES-256-GCM crypto helper for Ollama keys           │
       │   • SSE endpoint /api/prompts/refine (streaming A/B)    │
       └──────────────────────┬────────────────────────────────┘
                              │ Prisma / TCP 5432
                              ▼
       ┌───────────────────────────────────────────────────────┐
       │   Docker: prompt-factory-v2_db_1  (Postgres 16)      │
       │   Volume: postgres_data                               │
       └───────────────────────────────────────────────────────┘
```

## 📦 Project layout

```
src/
  app/                  # Next.js App Router
    api/                #   Backend endpoints
      auth/             #     signin + signup
      prompts/          #     CRUD + favorite + refinements + refine (SSE)
      settings/         #     ollama (GET/PUT/DELETE) + test
    auth/               #   Sign-in / sign-up pages
    prompts/            #   Prompt list, new, edit, use
    settings/           #   User settings UI
  lib/                  # Shared server-side helpers
    auth.ts             #   NextAuth v5 config (cookies hardened)
    crypto.ts           #   AES-256-GCM helpers
    ollama.ts           #   Ollama Cloud client (streaming + A/B)
    prisma.ts           #   Prisma client singleton
    prompt-variables.ts #   {{VAR}} parser / renderer
    rate-limit.ts       #   In-memory sliding-window limiter
    __tests__/          #   Standalone tsx test scripts
prisma/
  schema.prisma         # User, Prompt, UserOllamaConfig, Refinement, Account, Session
  migrations/           # SQL migrations
```

## 🚀 Production setup (VPS)

```bash
# 1. Point a DNS A record at your VPS
# 2. Clone and configure
git clone https://github.com/oliverlaudan-ops/prompt-factory-v2.git /opt/prompt-factory-v2
cd /opt/prompt-factory-v2
cp .env.example .env && nano .env

# 3. Build and start
docker compose up -d --build
docker compose exec app npx prisma migrate deploy

# 4. Set up the host-Nginx vhost
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
        # SSE needs these to avoid buffering
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

## ✨ AI Refinement (Ollama Cloud)

Users add their own Ollama Cloud API key in **Settings**. The key is encrypted
with AES-256-GCM (`ENCRYPTION_KEY`) before being written to the DB and is
**never** returned in cleartext to the frontend.

**Flow:**
1. User saves key in `/settings` → encrypted at rest in `UserOllamaConfig`
2. User clicks "✨ Mit KI verbessern" / "✨ Refine with AI" on the edit page
3. Server decrypts the key in-memory, calls `https://ollama.com/v1/chat/completions`
4. Server streams deltas via SSE back to the browser (token-by-token UI)
5. User sees **two variants side-by-side** (A/B mode) and picks one

**Models (curated subset):** `minimax-m3:cloud`, `kimi-k2.5:cloud`,
`qwen3-coder:cloud`, `gpt-oss:120b-cloud`, `deepseek-v3.1:cloud`.

**Safety:**
- Key never logged or returned to the frontend
- Rate-limited: 20 refinements / hour / user; 5 connection tests / 5 min
- Database backups without `ENCRYPTION_KEY` are useless on their own
- **Privacy:** Your prompt text is sent to Ollama Cloud during refinement.
  Check their DPA if your prompts contain sensitive data.

## 🗃️ Data model

See [`prisma/schema.prisma`](prisma/schema.prisma). The key models are:

- `User` — `email`, `name?`, `password?` (bcrypt)
- `Prompt` — `userId`, `title`, `content` (supports `{{VARIABLES}}`), `isFavorite`, `isPublic`
- `UserOllamaConfig` — 1:1 with `User`, holds the encrypted Ollama key
- `Refinement` — history of AI refinements per prompt (for the diff view)
- `Account` / `Session` — NextAuth standard

## 🛠️ Development

```bash
npm install                # also runs `prisma generate`
npm run dev                # Next dev server
npm run typecheck          # tsc --noEmit
npm test                   # all standalone tests
npm run lint               # next lint (eslint)
npm run db:reset           # ⚠ drops & re-migrates the dev DB
```

**Adding a new API route?** See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
conventions (auth check, validation, error shape, rate limiting).

**Adding a test?** Drop a `*.test.ts` in `src/lib/__tests__/` and add it to
the `test` script in `package.json`. We deliberately use a tiny hand-rolled
assert harness — no Jest, no Vitest, zero deps.

## 💾 Backup / Restore

A v1 → v2 import script is bundled at `imports/import_v1.mjs`:

```bash
docker cp v1-backup.json prompt-factory-v2_app_1:/app/
docker cp imports/import_v1.mjs prompt-factory-v2_app_1:/app/
docker exec prompt-factory-v2_app_1 sh -c "cd /app && node import_v1.mjs v1-backup.json"
```

Flags: `--force` overwrites existing prompts, `--dry-run` simulates only.
Idempotent by default (skips prompts with the same title).

## 📄 License

MIT — see [`LICENSE`](LICENSE).

## 🤝 Contributing

PRs welcome! Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. Bug reports
and feature requests: open an issue on GitHub.
