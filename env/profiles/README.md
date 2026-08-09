# Trust My Card environment profiles

## File layout (same for every profile)

```
env/profiles/
  development/
  production-preview/
  production/
    platform.env.example
    backend.env.example         # local / VPS monolith
    backend-api.env.example     # Render API (no collection keys)
    backend-worker.env.example  # Render workers (signing)
    website.env.example         # wallet app (app.*)
    marketing.env.example       # static marketing build
    admin.env.example
```

**Wallet SDK** has no separate env file — it runs inside the wallet app.

## Split backend roles (production)

| `SERVICE_ROLE` | Overlay file         | Collection keys      |
| -------------- | -------------------- | -------------------- |
| `api`          | `backend-api.env`    | not allowed          |
| `worker`       | `backend-worker.env` | required             |
| `all`          | `backend.env`        | optional (local dev) |

See [docs/infrastructure/secrets.md](../../docs/infrastructure/secrets.md).

## Setup

```bash
PROFILE=production   # or development, production-preview

cp env/profiles/$PROFILE/platform.env.example env/profiles/$PROFILE/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env
# Production split deploy also:
cp env/profiles/$PROFILE/backend-api.env.example env/profiles/$PROFILE/backend-api.env
cp env/profiles/$PROFILE/backend-worker.env.example env/profiles/$PROFILE/backend-worker.env
cp env/profiles/$PROFILE/marketing.env.example env/profiles/$PROFILE/marketing.env
```

## Switch environments

| Goal               | Commands                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Development        | `npm run start:dev`, `npm run dev:website`, `npm run dev:marketing`, `npm run dev:admin`   |
| Production preview | `npm run preview`, `npm run preview:website`, `npm run preview:admin`                      |
| Production         | [render-hostinger-production.md](../../docs/infrastructure/render-hostinger-production.md) |

Loader: [`config/load-env.mjs`](../../config/load-env.mjs).

See [docs/infrastructure/environments.md](../../docs/infrastructure/environments.md).
