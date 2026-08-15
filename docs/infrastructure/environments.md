# Environments — Development, Production Preview, Production

Trust My Card uses one codebase and three configuration profiles. The active profile is selected by **`TMC_ENV`**, set explicitly on each npm script or in Render/PM2 — never by copying files between apps.

| `TMC_ENV`            | Purpose                                | How to run                                                                                         |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `development`        | Daily feature work                     | `npm run start:dev` (backend), `npm run dev:website`, `npm run dev:marketing`, `npm run dev:admin` |
| `production-preview` | Test prod config locally before deploy | `npm run preview` (backend), `npm run preview:website`, `npm run preview:admin`                    |
| `production`         | Live stack                             | VPS micro (`deploy.sh`) or Render + Hostinger static marketing |

## How loading works

[`config/load-env.mjs`](../../config/load-env.mjs) reads, in order (later overrides earlier):

1. `config/platform.env` (legacy fallback)
2. `env/profiles/$TMC_ENV/platform.env` (if present)
3. App legacy `.env` / `.env.local`
4. `env/profiles/$TMC_ENV/{backend|backend-api|backend-worker|website|marketing|admin}.env` (if present)

For Render, `SERVICE_ROLE=api` loads `backend-api.env`; `SERVICE_ROLE=worker` loads `backend-worker.env`.

## One-time profile setup

For each profile you use, copy examples and fill secrets (never commit live files):

```bash
PROFILE=development   # or production-preview, production

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
cp env/profiles/$PROFILE/marketing.env.example env/profiles/$PROFILE/marketing.env

# Production Render split (production profile only):
cp env/profiles/$PROFILE/backend-api.env.example   env/profiles/$PROFILE/backend-api.env
cp env/profiles/$PROFILE/backend-worker.env.example env/profiles/$PROFILE/backend-worker.env
```

### Production preview database (once)

```bash
createdb trustmycard_preview
TMC_ENV=production-preview npm run prisma:migrate --prefix backend
```

## Resource isolation

| Resource             | development         | production-preview          | production              |
| -------------------- | ------------------- | --------------------------- | ----------------------- |
| PostgreSQL           | local `trustmycard` | local `trustmycard_preview` | Neon (external)         |
| Redis                | `127.0.0.1:6379/0`  | `127.0.0.1:6379/1`          | Upstash (external)      |
| Wallet keys          | Dev/test            | Prod keys (local only)      | Worker service only     |
| `ALLOW_SELF_SPENDER` | optional `true`     | `false`                     | `false`                 |
| Admin data           | Dev DB              | Preview DB                  | Production DB           |

Admin always reads from the backend pointed to by `BACKEND_API_URL` in its profile — no in-app environment switch.

## Admin: development vs production-preview vs production

Admin does **not** have a dropdown to switch environments. It shows data from whichever backend its active profile connects to.

| What you run            | Admin URL                       | Backend                     | Database              |
| ----------------------- | ------------------------------- | --------------------------- | --------------------- |
| `npm run dev:admin`     | `http://localhost:3002`         | dev backend (`start:dev`)   | `trustmycard`         |
| `npm run preview:admin` | `http://localhost:3002`         | preview backend (`preview`) | `trustmycard_preview` |
| Production (micro VPS)  | `http://localhost:3002`         | remote API                  | Neon (production)     |

**To compare dev vs preview locally:** run one stack at a time (both use port 3002).

## Workflows

### Development

```bash
cd backend && npm run start:dev
cd frontend && npm run dev:website    # :3000 — product at /
cd frontend && npm run dev:marketing  # :3001 — marketing static preview
cd frontend && npm run dev:admin      # :3002
```

### Production preview

```bash
cd backend && npm run preview
cd frontend && npm run preview:website
cd frontend && npm run preview:admin
```

Uses production-like flags and isolated DB/Redis while still on localhost. Website/admin run `next start` (production build), not dev hot-reload.

### Production

- **Micro VPS (current):** [deploy/README.md](../../deploy/README.md) — backend + wallet + Caddy on 512 MB droplet, Neon + Upstash.
- **Render budget:** [render-budget-production.md](./render-budget-production.md)
- **Render full (legacy):** [render-hostinger-production.md](./render-hostinger-production.md)

`ecosystem.config.cjs` remains for optional local all-in-one (`SERVICE_ROLE=all`) — not the recommended production path.

## Verify isolation

1. Run preview, create test data in admin — confirm it does not appear in development admin.
2. Switch back to `dev:*` — development data unchanged.
3. Confirm `git status` does not show live profile secrets.

## Related docs

- [Platform configuration](../architecture/platform-configuration.md)
- [Secrets matrix](./secrets.md)
- [Profile templates](../../env/profiles/README.md)
