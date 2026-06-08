# Contributing to Prompt Factory v2

Thanks for your interest in contributing! 🎉

## Quick start

```bash
# 1. Fork and clone
git clone https://github.com/<you>/prompt-factory-v2.git
cd prompt-factory-v2

# 2. Install deps (also runs `prisma generate`)
npm install

# 3. Copy env template and fill in
cp .env.example .env
# Edit .env: NEXTAUTH_SECRET, ENCRYPTION_KEY, DATABASE_URL

# 4. Start Postgres + app
docker compose up -d
npm run db:migrate

# 5. Run tests + typecheck
npm test
npm run typecheck
```

## Project layout

```
src/
  app/              # Next.js App Router (pages + API routes)
    api/            # Backend HTTP endpoints
    auth/           # Sign-in / sign-up pages
    prompts/        # Prompt CRUD pages
    settings/       # User settings (Ollama config)
  lib/              # Shared server-side helpers
    auth.ts         # NextAuth v5 config
    crypto.ts       # AES-256-GCM helpers
    ollama.ts       # Ollama Cloud client (streaming + A/B)
    prisma.ts       # Prisma client singleton
    prompt-variables.ts  # {{VARIABLE}} parser
    rate-limit.ts   # In-memory sliding-window limiter
    __tests__/      # Standalone tsx-runnable test scripts
prisma/
  schema.prisma     # User, Prompt, UserOllamaConfig, Account, Session
  migrations/       # SQL migrations
```

## Development workflow

1. **Create a branch** from `main`: `git checkout -b feat/short-description`
2. **Make your change.** Keep commits small and focused.
3. **Run before pushing:**
   ```bash
   npm run typecheck   # tsc --noEmit
   npm test            # all standalone tests
   npm run lint        # next lint
   ```
4. **Push and open a PR** against `main`. Use a clear title and a short
   description of *what* changed and *why*.

## Style guide

- TypeScript strict mode is on — no `any` unless you have a comment
  explaining why.
- German UI strings are fine (this is a German-language app), but
  **commit messages, code comments, and PR descriptions are English**.
- Prefer named exports over default exports for `src/lib/*` (better
  refactoring in IDEs).
- API routes return `NextResponse.json({ error: "..." }, { status: ... })`
  on failure — never throw across the route boundary.

## Testing

We use a tiny hand-rolled assert harness — no Jest, no Vitest, no deps.
Tests live in `src/lib/__tests__/*.test.ts` and are run with `tsx`:

```bash
npx tsx src/lib/__tests__/crypto.test.ts
npx tsx src/lib/__tests__/prompt-variables.test.ts
# or both at once:
npm test
```

When adding a new test file, also add it to the `test` script in
`package.json`. Keep the test scripts standalone (no shared harness file)
so each can be run in isolation.

## Adding a new API route

1. Create `src/app/api/<path>/route.ts`.
2. Start with `const session = await auth()` and bail with `401` if no user.
3. Validate input — return `400` with a German error message.
4. Wrap DB calls in `try`/`catch` and return `500` on unhandled errors.
5. If the endpoint is sensitive (writes, settings, refinement), add it
   to the rate limiter (`src/lib/rate-limit.ts`) — pick a reasonable
   `limit`/`windowMs` pair and document it inline.

## Reporting bugs

Open an issue at
<https://github.com/oliverlaudan-ops/prompt-factory-v2/issues> with:

- Steps to reproduce
- Expected vs. actual behaviour
- Browser / Node / Postgres version (from `npm ls` and `docker compose ps`)
- Relevant logs (`docker compose logs app`)

## License

By contributing, you agree that your contributions will be licensed under
the MIT License (see `LICENSE`).
