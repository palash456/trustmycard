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

| `SERVICE_ROLE` | Overlay file         | Collection keys      |
| -------------- | -------------------- | -------------------- |
| `api`          | `backend-api.env`    | not allowed          |
| `worker`       | `backend-worker.env` | required             |
| `all`          | `backend.env`        | optional (local dev / micro VPS) |

See [docs/infrastructure/secrets.md](../../docs/infrastructure/secrets.md).

## Setup

```bash
PROFILE=production   # or development

cp config/platform.env.example config/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
# Production split deploy also:
cp env/profiles/$PROFILE/backend-api.env.example env/profiles/$PROFILE/backend-api.env
cp env/profiles/$PROFILE/backend-worker.env.example env/profiles/$PROFILE/backend-worker.env
```

## Switch environments

| Goal               | Commands                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Development        | `npm run start:dev`, `npm run dev:website`, `npm run dev:marketing`, `npm run dev:admin` |
| Production (VPS)   | [deploy/README.md](../../deploy/README.md) — micro topology + Caddy                      |
| Production (Render)| [render-budget-production.md](../../docs/infrastructure/render-budget-production.md)     |

Loader: [`config/load-env.mjs`](../../config/load-env.mjs).

See [docs/infrastructure/environments.md](../../docs/infrastructure/environments.md).
