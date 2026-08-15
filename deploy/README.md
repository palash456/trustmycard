# Trust My Card — provider-independent Docker deploy

OCI images are the common artifact. Provider adapters only ship and start containers.

## Commands

```bash
./deploy.sh production --fresh --provider local
./deploy.sh production --provider local
./deploy.sh production --fresh --provider docker-vps
```

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
