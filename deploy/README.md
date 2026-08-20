# Trust My Card — provider-independent Docker deploy

OCI images are the common artifact. Provider adapters only ship and start containers.

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
# fill backend.env (DATABASE_URL, REDIS_URL, keys) + website.env (NEXT_PUBLIC_*)
# edit deploy/provider.credentials.env (VPS_HOST, VPS_USER, VPS_SSH_KEY)

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

See [docs/infrastructure/one-step-deploy.md](../docs/infrastructure/one-step-deploy.md).

## VPS provider / server migration

Moving between VPS providers (DigitalOcean → Hetzner, new droplet, etc.) while keeping Docker + Caddy + `micro` topology: update `deploy/provider.credentials.env` (`VPS_HOST`, and optionally `VPS_USER` / `VPS_SSH_KEY` / `VPS_DEPLOY_PATH`), point DNS A records to the new IP, then:

```bash
./deploy.sh production --fresh --provider docker-vps --confirm-external-data   # first deploy to new box
./deploy.sh production --provider docker-vps                                   # later deploys
```

Do **not** put SSH credentials in `config/platform.env`. Full guide: [docs/infrastructure/vps-migration.md](../docs/infrastructure/vps-migration.md).
