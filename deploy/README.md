# Trust My Card — provider-independent Docker deploy

OCI images are the common artifact. Provider adapters only ship and start containers.

**Local day-to-day development** (`npm run start:dev`, `dev:website`, `dev:admin`) uses **native Postgres + Redis on the host** — no Docker. This folder is for production builds, VPS deploy, and CI smoke tests only.

## Commands

```bash
./deploy.sh production --fresh --provider local
./deploy.sh production --provider local
./deploy.sh production --fresh --provider docker-vps
```

### 512 MB VPS (`micro` topology)

Runs **backend + wallet only** with **external** Neon Postgres + Upstash Redis. Images are built on your machine and streamed to the VPS (`docker save | ssh docker load`) — the VPS never runs `npm` or `docker build`.

```bash
npm run setup:production
# Secrets: npm run setup:export:all → push env/vaultDDMMHHmmss.zip → npm run setup:import on new PC
# Or fill backend.env, website.env, deploy/provider.credentials.env manually

./deploy.sh production --fresh --provider docker-vps
./deploy.sh production --provider docker-vps   # subsequent deploys
```

Admin runs locally. **Caddy** (ports 80/443) is deployed automatically on `docker-vps` + `micro` for Let's Encrypt TLS.

### Validate micro locally (before VPS)

Uses bundled Postgres/Redis on alternate ports so it can run beside a `budget` stack:

```bash
chmod +x deploy/scripts/validate-micro-local.sh
node deploy/test/micro-topology.test.mjs          # unit checks only
./deploy/scripts/validate-micro-local.sh        # unit + dry-run + docker deploy
SKIP_DEPLOY=1 ./deploy/scripts/validate-micro-local.sh   # skip docker up
```

Or manually:

```bash
cp deploy/manifest.production.micro.local.example.json deploy/manifest.production.json
TMC_HOST_API_PORT=4004 TMC_HOST_WALLET_PORT=3004 ./deploy.sh production --topology=micro --provider=local
```

Smoke: `http://localhost:4004/v1/api/settings/public` and `http://localhost:3004/api/settings/public`

### Wallet env (`website.env`)

Required for Docker/Render wallet builds:

| Variable                 | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`    | Public site URL (WalletConnect allowed origin)                             |
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect Cloud project id                                             |
| `BACKEND_API_URL`        | Nest API URL (Docker micro uses internal `http://backend:4000` at runtime) |

Removed (legacy marketing session gate): `MARKETING_SESSION_*`, `MARKETING_TEST_SECRET`, `GOOGLE_ADS_*`. See `frontend/website/README.md`.

## Topologies

| Topology | Containers                                | Use case                 |
| -------- | ----------------------------------------- | ------------------------ |
| `micro`  | backend + wallet                          | 512 MB VPS, external DB  |
| `budget` | + admin + marketing + optional bundled DB | local / larger VPS       |
| `full`   | split API + worker                        | production split signing |

## Layout

```
deploy/
  cli.mjs                 # entrypoint
  manifest.*.json         # deploy target (production copy is gitignored)
  core/                   # provider-independent pipeline
  adapters/               # local, docker-vps, stubs
  docker/                 # Dockerfiles
  compose/                # docker-compose stacks
  compiled/               # generated per-service env (gitignored)
  state/                  # last deploy metadata (gitignored)
```

## Safety flags

| Flag                                           | Meaning                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `--fresh`                                      | Provision bundled Postgres/Redis if needed (never drops data by default) |
| `--confirm-recreate-data --i-accept-data-loss` | Remove **only** the named compose Postgres volume                        |
| `--confirm-external-data`                      | Allow `--fresh` against external `DATABASE_URL` hosts                    |

See `deploy/core/verify.mjs` for post-deploy checks.

## VPS provider / server migration

Moving between VPS providers (DigitalOcean → Hetzner, new droplet, etc.) while keeping Docker + Caddy + `micro` topology: update `deploy/provider.credentials.env` (`VPS_HOST`, and optionally `VPS_USER` / `VPS_SSH_KEY` / `VPS_DEPLOY_PATH`), point DNS A records to the new IP, then:

```bash
./deploy.sh production --fresh --provider docker-vps --confirm-external-data   # first deploy to new box
./deploy.sh production --provider docker-vps                                   # later deploys
```

Do **not** put SSH credentials in `config/platform.env`. Update `deploy/provider.credentials.env`, point DNS A records to the new VPS IP, then redeploy with `./deploy.sh production --provider docker-vps`.

## Post-deploy checklist

After the stack is up, confirm **runtime config** — not only containers:

| Task | Files | Notes |
| ---- | ----- | ----- |
| DNS + TLS | Cloudflare A records → VPS IP | A records for apex + `api.` → VPS IP |
| Domain / Meta Pixel | `deploy/runtime-config/production.json` | `npm run config:sync-vps` after local updates |
| Platform policy | `config/platform.env`, `env/vault/config/platform.env` | Eligibility `NEXT_PUBLIC_*_MIN_*_BALANCE`, wallets, flags |
| `NEXT_PUBLIC_*` changes | Rebuild wallet image | `--skip-images` is **not** enough |
| Locales / tab title | `frontend/website/locales/*.json` | Rebuild wallet after locale edits |
| Smoke tests | curl apex + `api.` settings/public | Also WalletConnect on `/` |

Automated verify at end of deploy: `deploy/core/verify.mjs`.

### Production config from admin portal (Meta Pixel / domain)

When `ADMIN_PRODUCTION_CONFIG_ENABLED=true` on the API, the live admin **Production config** page runs the same config-only engine as `scripts/config-update.sh pixel|domain`.

On a **micro VPS**, the API container restarts services via the **host Docker socket** (not SSH/rsync):

| Requirement | Notes |
| ----------- | ----- |
| `TMC_CONFIG_DEPLOY_LOCAL=true` | Set on backend (default in `docker-compose.micro.yml`) |
| Docker socket | `/var/run/docker.sock` mounted into `backend` |
| Compose + compiled env | `deploy/compose` (ro) and `deploy/compiled` (rw) mounted |
| Docker CLI in backend image | Rebuild `tmc/backend:production` after Dockerfile changes |

From your dev machine, config changes still use SSH via `deploy/provider.credentials.env`. Only the on-VPS API uses local socket mode.
