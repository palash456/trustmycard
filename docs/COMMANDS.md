# Command reference — single source of truth

All terminal commands for Trust My Card. The Admin Panel mirrors this at **Documentation → Command Reference** (`/documentation/commands`).

Paths assume repo root unless noted.

---

## Essential commands (bookmark these)

### Local dev — daily

```bash
# Backend API (:4000) — run in backend/
npm run start:dev

# Wallet app (:3000) — run in frontend/
npm run dev:website

# Admin panel (:3002) — run in frontend/
npm run dev:admin

# Optional: marketing preview (:3001)
npm run dev:marketing
```

Start backend before admin or website. **Live ops:** admin on Vercel → production API. **Local ops:** `npm run dev:admin` against localhost or production API.

### Environment setup (new machine)

```bash
npm run setup                  # bootstrap dev env files from templates
npm run setup:all              # dev + production + deploy files

# Main PC — export secrets before moving to another machine:
npm run setup:export:all       # → env/vault/ + env/vaultDDMMHHmmss.zip (password-protected, pushable)
# Password: Microsoft@2025 + HHmmss  (vault2008213703.zip → Microsoft@2025213703)

# New PC (use your zip filename, or omit for latest):
npm run setup:import -- vault2009212902.zip
npm run setup:all
```

See `docs/infrastructure/environments.md` for vault naming, zip password, and `--from` option.

### Stuck dev servers

```bash
cd frontend
npm run dev:stop
npm run dev:website:reset   # website only
```

### Production VPS — push live (Docker)

| Goal | Command |
| --- | --- |
| **Full deploy** (build images + migrate DB + restart) | `./deploy.sh production --provider=docker-vps` |
| **Code only** (skip DB migrations) | `./deploy.sh production --provider=docker-vps --skip-migrate` |
| **Config / env only** (reuse images, no migrate) | `./deploy.sh production --provider=docker-vps --skip-images` |
| **First deploy on fresh VPS** | `./deploy.sh production --fresh --provider=docker-vps` |
| **Validate before push** (no Docker) | `./deploy.sh production --dry-run` |

### Runtime config (domain / Meta pixel) — no code rebuild

```bash
npm run config:status
./scripts/config-update.sh domain https://exampleUrl.com --actor "you@machine"
./scripts/config-update.sh pixel YOUR_PIXEL_ID --actor "you@machine"
npm run config:sync-vps          # mirror state to VPS if init ran locally
```

`domain` / `pixel` updates trigger a **config-only** Docker release on `docker-vps` (restarts `wallet`; domain also restarts `caddy` + `backend`). No image build, no `prisma migrate`.

### Tests (before deploy)

```bash
cd backend && npm test
cd frontend/wallet-sdk && npm test
cd frontend/shared && npm test
```

### Live admin panel — Vercel deploy

Admin ops console is deployed to **Vercel** (not the micro VPS). It talks to the production API at `api.exampleUrl.com`.

```bash
# Install CLI (once)
npm i -g vercel

# From admin package — link + deploy
cd frontend/admin
vercel login
vercel link
vercel env pull .env.local    # optional: download Vercel env for local prod build
vercel                        # preview deploy
vercel --prod                 # production deploy

# Same build Vercel runs (verify before push)
cd frontend && TMC_ENV=production npm run build:admin
cd frontend && npm run lint:admin
```

Set env in **Vercel → Project → Settings → Environment Variables** (Production): `BACKEND_API_URL`, `ADMIN_API_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_PANEL_PASSWORD`, plus optional section passwords. See `env/profiles/production/admin.env.example`.

Git-connected project: push to the linked branch triggers deploy automatically.

---

## First-time setup

### Install dependencies

```bash
cd frontend && npm install
cd backend && npm install
```

Root `package.json` only installs Prettier (`npm install` at repo root optional).

### Environment files

From repo root (replaces manual `cp` of every `*.example` file):

```bash
npm run setup                  # development profile
npm run setup:production       # production + deploy credentials
npm run setup:all              # both profiles + deploy
```

**New machine / second PC** — git has templates only, not secrets:

```bash
# Main machine (whenever secrets change):
npm run setup:export:all
# → updates env/vault/ and creates env/vaultDDMMHHmmss.zip (password-protected, pushable)
# Password: Microsoft@2025 + HHmmss  (vault2008213703.zip → Microsoft@2025213703)

# New machine (replace filename with your zip):
npm run setup:import -- vault2009212902.zip
npm run setup:all
```

Alternative: `npm run setup:all -- --from /path/to/main/repo` (or `TMC_SETUP_SOURCE`).

Never commit live `config/platform.env`, profile `*.env`, or `env/vault/` (folder). Password-protected `env/vault*.zip` files may be committed. See `docs/infrastructure/environments.md`.

### Database (local)

```bash
cd backend
npm run prisma:generate
npm run prisma:push          # dev schema sync
# or
npm run prisma:migrate       # create/apply migrations in dev
npm run prisma:seed          # optional seed
```

### Local Postgres + Redis via Docker

```bash
cd backend
npm run dev:deps             # docker compose up postgres redis
npm run dev:deps:down        # stop
```

Compose files: `deploy/compose/docker-compose.base.yml` + `docker-compose.local-dev.yml`.

---

## Local development

### Ports

| App | Port | Start command (from correct directory) |
| --- | --- | --- |
| Website (wallet) | 3000 | `cd frontend && npm run dev:website` |
| Marketing | 3001 | `cd frontend && npm run dev:marketing` |
| Admin | 3002 | `cd frontend && npm run dev:admin` |
| Backend API | 4000 | `cd backend && npm run start:dev` |

### Frontend workspace scripts (`frontend/`)

```bash
npm run dev:website
npm run dev:admin
npm run dev:marketing
npm run dev:sdk              # wallet-sdk TypeScript watch
npm run dev:stop             # kill stale dev processes
npm run dev:website:reset
npm run build:website
npm run build:admin
npm run build:marketing
npm run build:sdk
npm run build:shared
npm run lint
npm run lint:admin
npm run lint:website
npm run lint:marketing
npm run format
npm run format:check
```

### Backend scripts (`backend/`)

```bash
npm run start:dev            # API with watch (:4000)
npm run start:workers:dev    # worker entry with watch
npm run build
npm run start:prod           # dist/main.js
npm run start:workers        # dist/worker.js (signing enabled)
npm run lint
npm run test
npm run test:resources       # resource manager subset
npm run prisma:generate
npm run prisma:migrate
npm run prisma:push
npm run prisma:seed
npm run prisma:status
npm run collections:backfill
npm run db:delete-local      # interactive local DB cleanup
npm run db:delete-local:all
npm run db:delete-local:today
npm run db:delete-local:1h
npm run db:delete-local:10m
```

Swagger: `http://localhost:4000/v1/docs`

### Stop dev servers manually (`frontend/`)

```bash
node scripts/stop-dev.mjs website
node scripts/stop-dev.mjs admin
node scripts/stop-dev.mjs backend
node scripts/stop-dev.mjs all
```

### Monorepo root (`package.json`)

```bash
npm run format
npm run format:check
npm run lint                 # frontend workspaces
npm run config:status
npm run config:init          # runtime config init
npm run config:sync-vps
npm run domain:migrate       # ./deploy.sh production --dry-run
```

---

## Testing

```bash
cd backend && npm test
cd backend && npm run test:resources
cd frontend/wallet-sdk && npm test
cd frontend/wallet-sdk && npm run test:approval
cd frontend/wallet-sdk && npm run test:native-transfer
cd frontend/wallet-sdk && npm run test:authorization
cd frontend/shared && npm test
```

### Deploy / topology checks

```bash
node deploy/test/micro-topology.test.mjs
chmod +x deploy/scripts/validate-micro-local.sh
./deploy/scripts/validate-micro-local.sh
SKIP_DEPLOY=1 ./deploy/scripts/validate-micro-local.sh
```

### Manual QA

- Admin **Developer Test** (`/developer-test`) when `ADMIN_DEV_OPS=true` and non-production backend.
- Checklist: `docs/operations/admin-pipeline-validation.md`

---

## Build for production (local artifacts)

```bash
cd frontend && npm run build:shared && npm run build:website && npm run build:admin
cd backend && npm run build
```

Individual packages:

```bash
cd frontend/website && npm run build
cd frontend/admin && npm run build
cd frontend/marketing && TMC_ENV=production npm run build
cd frontend/wallet-sdk && npm run build
cd frontend/shared && npm run build
```

---

## Production deploy — Docker VPS (current)

Prerequisites:

```bash
cp deploy/manifest.production.micro.example.json deploy/manifest.production.json
cp env/profiles/production/backend.env.example env/profiles/production/backend.env
# Fill backend.env (DATABASE_URL, REDIS_URL, keys) + website.env (NEXT_PUBLIC_*)
cp deploy/provider.credentials.example.env deploy/provider.credentials.env
# Fill VPS_HOST, VPS_USER, VPS_SSH_KEY
chmod +x deploy.sh
```

### Deploy scenarios

```bash
# Standard — build images locally, stream to VPS, prisma migrate deploy, compose up
./deploy.sh production --provider=docker-vps

# Fresh host — install Docker on VPS, provision data layer if bundled
./deploy.sh production --fresh --provider=docker-vps

# Code + images only — skip database migrations
./deploy.sh production --provider=docker-vps --skip-migrate

# Config / compiled env only — reuse existing images on VPS
./deploy.sh production --provider=docker-vps --skip-images

# Skip local image build (reuse tags already built)
./deploy.sh production --provider=docker-vps --skip-build

# Validate manifest + env compilation only
./deploy.sh production --dry-run
./deploy.sh production --dry-run --topology=micro --provider=local
```

### Safety flags

| Flag | Meaning |
| --- | --- |
| `--fresh` | Provision Docker/data services; does **not** drop Postgres volumes by default |
| `--confirm-external-data` | Allow `--fresh` when `DATABASE_URL` points to Neon/external host |
| `--confirm-recreate-data --i-accept-data-loss` | Drop **bundled** Postgres volume (destructive) |
| `--topology=micro\|budget\|full` | Override manifest topology |
| `--provider=local\|docker-vps` | Target adapter |

### Micro topology local smoke test

```bash
cp deploy/manifest.production.micro.local.example.json deploy/manifest.production.json
TMC_HOST_API_PORT=4004 TMC_HOST_WALLET_PORT=3004 \
  ./deploy.sh production --topology=micro --provider=local
```

Smoke URLs: `http://localhost:4004/v1/api/settings/public`, `http://localhost:3004/api/settings/public`

### Database migrations (production)

Included automatically on deploy unless `--skip-migrate`.

Manual (operator machine, production env):

```bash
cd backend
export TMC_ENV=production
export SERVICE_ROLE=api
npx prisma migrate deploy
```

Render migrate script: `scripts/render-migrate.sh`

### VPS SSH — logs and restart

Default deploy path: `/opt/tmc`. Compose project from manifest (micro example: `tmc-production-micro`).

```bash
ssh deploy@YOUR_VPS_HOST
cd /opt/tmc

# Logs (micro + external data + Caddy edge)
docker compose -p tmc-production-micro \
  -f deploy/compose/docker-compose.base.yml \
  -f deploy/compose/docker-compose.micro.yml \
  -f deploy/compose/docker-compose.external-data.yml \
  -f deploy/compose/docker-compose.micro-edge.yml \
  logs -f backend wallet caddy

# Restart a service
docker compose -p tmc-production-micro \
  -f deploy/compose/docker-compose.base.yml \
  -f deploy/compose/docker-compose.micro.yml \
  -f deploy/compose/docker-compose.external-data.yml \
  -f deploy/compose/docker-compose.micro-edge.yml \
  restart caddy
```

Install Docker on fresh Ubuntu VPS: `deploy/scripts/provision-vps-docker.sh` (also run via `--fresh`).

---

## Runtime configuration (domain / Meta pixel)

State: `deploy/runtime-config/production.json` locally; `/opt/tmc/deploy/runtime-config/` on VPS.

```bash
npm run config:status
./scripts/config-update.sh status
./scripts/config-update.sh history --limit 10

# One-time init (seed from compiled deploy artifacts)
npm run config:init
./scripts/config-update.sh init --environment production --from-compiled --actor "you@machine"

# Updates (config-only release on docker-vps)
./scripts/config-update.sh domain https://exampleUrl.com --actor "you@machine"
./scripts/config-update.sh pixel 123456789012345 --actor "you@machine"

# Sync local state file to VPS
npm run config:sync-vps
./deploy/scripts/sync-runtime-config-to-vps.sh production
```

`config/platform.env` must keep `WEBSITE_DOMAIN=""` and `META_PIXEL_ID=""` after migration. Full runbook: `docs/operations/runtime-config.md`.

Admin portal can run the same updates when `ADMIN_PRODUCTION_CONFIG_ENABLED=true` on the API host.

---

## Admin panel

Live admin runs on **Vercel** against the production API. Local dev uses `localhost:3002`. Admin is **not** on the micro VPS Docker stack.

### Run locally

```bash
cp env/profiles/development/admin.env.example env/profiles/development/admin.env
cd backend && npm run start:dev
cd frontend && npm run dev:admin    # http://localhost:3002
```

### Local against production API

```bash
# env/profiles/production/admin.env
BACKEND_API_URL=https://api.exampleUrl.com
ADMIN_API_KEY=<matches backend>

cd frontend && TMC_ENV=production npm run dev:admin
```

Optional local-only production log toggle (`env/profiles/development/admin.env`):

```bash
ADMIN_ALLOW_PRODUCTION_LOGS=true
PRODUCTION_ADMIN_API_KEY=<same as production ADMIN_API_KEY>
```

### Build & run production Next server (local)

```bash
cd frontend && npm run build:admin
cd frontend/admin && npm run start    # :3002
```

### Vercel — first-time setup

1. Create a Vercel project with **Root Directory** = `frontend/admin` (monorepo).
2. `frontend/admin/vercel.json` sets install/build:

   - Install: `cd .. && npm install` (frontend workspace root)
   - Build: `cd .. && TMC_ENV=production npm run build:admin`

3. Add environment variables in Vercel (Production + Preview as needed):

| Variable | Required | Purpose |
| --- | --- | --- |
| `BACKEND_API_URL` | Yes | Production API, e.g. `https://api.exampleUrl.com` |
| `ADMIN_API_KEY` | Yes | Must match backend `ADMIN_API_KEY` |
| `ADMIN_SESSION_SECRET` | Yes | Signs `admin_session` cookie |
| `ADMIN_PANEL_PASSWORD` | Yes | Login screen password |
| `ADMIN_PRODUCTION_CONFIG_PASSWORD` | Optional | Gate `/settings/production-config` |
| `ADMIN_ACTIONS_PASSWORD` | Optional | Gate admin actions area |
| `ADMIN_DOCUMENTATION_PASSWORD` | Optional | Gate documentation |
| `ADMIN_DEVELOPER_TEST_PASSWORD` | Optional | Gate developer test (non-prod API only) |
| `ADMIN_SYSTEM_PASSWORD` | Optional | Gate system page |
| `ADMIN_IDENTITY_HEADER` | Optional | Cloudflare Access email header for audit |

Template: `env/profiles/production/admin.env.example`

### Vercel — deploy commands

```bash
npm i -g vercel

cd frontend/admin
vercel login
vercel link                    # link to existing Vercel project
vercel env pull .env.local     # sync remote env locally (optional)
vercel                         # preview deployment
vercel --prod                  # production deployment
vercel ls                      # list recent deployments
vercel logs <deployment-url>   # stream runtime logs
vercel env add BACKEND_API_URL production   # add env var via CLI
vercel redeploy --prod         # redeploy latest production without git push
```

With **Git integration**: push to the connected branch (usually `main`) triggers Vercel build/deploy.

### Vercel — pre-deploy checks

```bash
cd frontend && npm run lint:admin
cd frontend && TMC_ENV=production npm run build:admin
```

Render alternative build script: `scripts/render-build-admin.sh`

### After deploy

- Open the Vercel URL → `/login` with `ADMIN_PANEL_PASSWORD`.
- Live admin uses **Production** data only (no Development switch). Use **Demo mode** if the API is down.
- Production config page (`/settings/production-config`) needs a healthy API; config *deploy* still requires `ADMIN_PRODUCTION_CONFIG_ENABLED=true` on the API host (use CLI on operator machine for micro VPS).

UI guide: Admin → Documentation → **Admin Panel Guide**.

### Developer Test panel

Requires backend `ADMIN_DEV_OPS=true` and `NODE_ENV` ≠ `production`. Route: `/developer-test` (local admin only; gated on live admin).

---

## Render (alternative hosting)

Guides:

- Budget (~$14/mo): `docs/infrastructure/render-budget-production.md`
- Full (~$60/mo): `docs/infrastructure/render-hostinger-production.md`

Build scripts: `scripts/render-build-*.sh`, `scripts/render-start-backend.sh`, `scripts/render-migrate.sh`.

---

## PM2 all-in-one (legacy / optional)

`ecosystem.config.cjs` — split API + worker + wallet + admin on one VPS with PM2. Not the recommended micro Docker path.

```bash
# After build + env/profiles/production/ configured
pm2 start ecosystem.config.cjs
pm2 status
pm2 restart all
pm2 logs
```

---

## Linting & formatting

```bash
# Repo root
npm run format
npm run format:check

# Frontend workspaces
cd frontend && npm run lint
cd frontend/admin && npm run lint
cd frontend/website && npm run lint
```

Logging antipattern check: `scripts/check-logging-antipatterns.sh`

---

## Related documentation

| Topic | Location |
| --- | --- |
| Deploy adapter details | `deploy/README.md` |
| One-step deploy | `docs/infrastructure/one-step-deploy.md` |
| Environments / `TMC_ENV` | `docs/infrastructure/environments.md` |
| Secrets matrix | `docs/infrastructure/secrets.md` |
| Runtime config ops | `docs/operations/runtime-config.md` |
| Admin UI guide | Admin → Documentation → Admin Panel Guide |
| Vercel admin config | `frontend/admin/vercel.json` |
| Admin env template | `env/profiles/production/admin.env.example` |
| Test catalog | `docs/testing/test-cases.md` |
