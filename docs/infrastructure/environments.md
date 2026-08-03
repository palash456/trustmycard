# Environments — Development, Production Preview, Production

Trust My Card uses one codebase and three configuration profiles. The active profile is selected by **`TMC_ENV`**, set explicitly on each npm script or in PM2 — never by copying files.

| `TMC_ENV` | Purpose | How to run |
|-----------|---------|------------|
| `development` | Daily feature work | `npm run start:dev` (backend), `npm run dev:website`, `npm run dev:admin` |
| `production-preview` | Test prod config locally before deploy | `npm run preview` (backend), `npm run preview:website`, `npm run preview:admin` |
| `production` | Live VPS | PM2 via [`ecosystem.config.cjs`](../../ecosystem.config.cjs) |

## How loading works

[`config/load-env.mjs`](../../config/load-env.mjs) reads, in order (later overrides earlier):

1. `config/platform.env` (legacy)
2. `env/profiles/$TMC_ENV/platform.env` (if present)
3. App legacy `.env` / `.env.local`
4. `env/profiles/$TMC_ENV/{backend|website|admin}.env` (if present)

## One-time profile setup

For each profile you use, copy examples and fill secrets (never commit live files):

```bash
PROFILE=development   # or production-preview, production

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
# Edit each live file with your secrets
```

### Production preview database (once)

```bash
createdb trustmycard_preview
TMC_ENV=production-preview npm run prisma:migrate --prefix backend
```

## Resource isolation

| Resource | development | production-preview | production (VPS) |
|----------|-------------|--------------------|------------------|
| PostgreSQL | `trustmycard` | `trustmycard_preview` | `trustmycard` |
| Redis | `127.0.0.1:6379/0` | `127.0.0.1:6379/1` | VPS `127.0.0.1:6379/0` |
| Wallet keys | Dev/test | Prod keys (local) | Prod keys |
| `ALLOW_SELF_SPENDER` | optional `true` | `false` | `false` |
| Admin logs/data | Dev DB only | Preview DB only | VPS DB only |

Admin always reads from the backend pointed to by `BACKEND_API_URL` in its profile — no in-app environment switch.

## Admin: development vs production-preview vs production logs

Admin does **not** have a dropdown to switch environments. It shows data from whichever backend its active profile connects to.

| What you run | Admin URL | Backend | Database | What you see |
|--------------|-----------|---------|----------|--------------|
| `npm run dev:admin` | `http://localhost:3002` | dev backend (`start:dev`) | `trustmycard` | Development logs, users, pipeline |
| `npm run preview:admin` | `http://localhost:3002` | preview backend (`preview`) | `trustmycard_preview` | Preview logs only (isolated from dev) |
| PM2 on VPS | `https://admin.trustmycard.com` | production API | VPS `trustmycard` | Live production data only |

**To compare dev vs preview locally:**

1. Terminal A — development stack:
   ```bash
   cd backend && npm run start:dev
   cd frontend && npm run dev:admin
   ```
   Open `http://localhost:3002` → Activity / Audit tabs show **development** data.

2. Stop dev admin (or use a different port is not supported — stop one stack before starting the other). Terminal B — preview stack:
   ```bash
   cd backend && npm run preview
   cd frontend && npm run preview:admin
   ```
   Open `http://localhost:3002` → same UI, but **preview** database (empty or separate test data).

Both use port 3002 — run **one stack at a time**. The environment is determined by which npm scripts you used to start backend + admin, not by a setting inside the admin UI.

Structured logs (Audit → Structured), timelines, activity feed, and pipeline data all come from the backend's PostgreSQL for that profile.

## Workflows

### Development (unchanged UX)

```bash
cd backend && npm run start:dev
cd frontend && npm run dev:website
cd frontend && npm run dev:admin
```

### Production preview

```bash
cd backend && npm run preview
cd frontend && npm run preview:website
cd frontend && npm run preview:admin
```

Uses production-like flags and isolated DB/Redis while still on localhost. Website/admin run `next start` (production build), not dev hot-reload.

### Production (VPS)

See [hostinger-deployment.md](./hostinger-deployment.md). PM2 sets `TMC_ENV=production` on all processes. Fill `env/profiles/production/` on the server.

## Verify isolation

1. Run preview, create test data in admin — confirm it does not appear in development admin.
2. Switch back to `dev:*` — development data unchanged.
3. Confirm `git status` does not show live profile secrets.

## Related docs

- [Platform configuration](../architecture/platform-configuration.md)
- [Hostinger deployment](./hostinger-deployment.md)
- [Profile templates](../../env/profiles/README.md)
