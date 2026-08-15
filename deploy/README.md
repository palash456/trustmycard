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
cp deploy/manifest.production.micro.example.json deploy/manifest.production.json
cp env/profiles/production/backend-budget.env.example env/profiles/production/backend-budget.env
# fill backend-budget.env (DATABASE_URL, REDIS_URL, keys) + website.env

cp deploy/provider.credentials.example.env deploy/provider.credentials.env
# fill VPS_HOST, VPS_USER, VPS_SSH_KEY

./deploy.sh production --fresh --provider docker-vps
./deploy.sh production --provider docker-vps   # subsequent deploys
```

Admin runs locally; marketing stays on a static host. Add **1 GB swap** on the VPS and terminate TLS with Caddy/nginx in front of ports 3000/4000.

## Topologies

| Topology | Containers | Use case |
|----------|------------|----------|
| `micro` | backend + wallet | 512 MB VPS, external DB |
| `budget` | + admin + marketing + optional bundled DB | local / larger VPS |
| `full` | split API + worker | production split signing |

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

| Flag | Meaning |
|------|---------|
| `--fresh` | Provision bundled Postgres/Redis if needed (never drops data by default) |
| `--confirm-recreate-data --i-accept-data-loss` | Remove **only** the named compose Postgres volume |
| `--confirm-external-data` | Allow `--fresh` against external `DATABASE_URL` hosts |

See [docs/infrastructure/one-step-deploy.md](../docs/infrastructure/one-step-deploy.md).
