# Trust My Card environment profiles

## File layout (same for every profile)

```
env/profiles/
  development/
  production/
    backend.env.example         # local dev / production infra (Postgres, Redis, origins)
    backend-api.env.example     # Render API (no collection keys)
    backend-worker.env.example  # Render workers (signing)
    website.env.example         # public site (wallet app)
    admin.env.example
```

**Platform config** (wallets, collector, chains, Meta Pixel): `config/platform.env` only — not duplicated per profile.

**Wallet SDK** has no separate env file — it runs inside the wallet app.

## Split backend roles (production)

| `SERVICE_ROLE` | Overlay file         | Collection keys                  |
| -------------- | -------------------- | -------------------------------- |
| `api`          | `backend-api.env`    | not allowed                      |
| `worker`       | `backend-worker.env` | required                         |
| `all`          | `backend.env`        | optional (local dev / micro VPS) |

See [docs/infrastructure/secrets.md](../../docs/infrastructure/secrets.md).

## Setup

```bash
npm run setup:node_modules     # from repo root — install all npm dependencies
npm run setup                  # development profile
npm run setup:production       # production + deploy files
npm run setup:all              # both profiles + deploy

npm run setup:export           # export dev secrets → env/vault/ + password-protected zip
npm run setup:export:all       # export all profiles + deploy (zip is git-pushable)
npm run setup:import -- vaultDDMMHHmmss.zip   # unzip on new PC (password auto-derived)
```

See `scripts/bootstrap-env.mjs --help` for flags (`--from`, `--manifest`, `--force`, etc.).

**New machine:** run `npm run setup:export:all`, push `env/vaultDDMMHHmmss.zip`, then on the new PC: `npm run setup:import` + `npm run setup:all`. Zip password: `Microsoft@2025` + `HHmmss` from the filename. Full guide: [environments.md](../../docs/infrastructure/environments.md).

## Switch environments

| Goal                | Commands                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Development         | `npm run start:dev`, `npm run dev:website`, `npm run dev:marketing`, `npm run dev:admin` |
| Production (VPS)    | [deploy/README.md](../../deploy/README.md) — micro topology + Caddy                      |
| Production (Render) | [render-budget-production.md](../../docs/infrastructure/render-budget-production.md)     |

Loader: [`config/load-env.mjs`](../../config/load-env.mjs).

See [docs/infrastructure/environments.md](../../docs/infrastructure/environments.md).
