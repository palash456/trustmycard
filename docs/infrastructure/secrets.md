# Secrets and environment variables

## Profile files

Templates live in `env/profiles/production/`. Copy examples to live files locally; on Render, set equivalent keys in the dashboard (or sync via Doppler).

| File                 | Used by                                |
| -------------------- | -------------------------------------- |
| `platform.env`       | API + worker (shared platform flags)   |
| `backend-api.env`    | Render `tmc-api` overlay               |
| `backend-worker.env` | Render `tmc-workers` overlay           |
| `website.env`        | Wallet app (+ local marketing preview via same file) |
| `admin.env`          | Render `tmc-admin`                                   |

Loader: [`config/load-env.mjs`](../../config/load-env.mjs) — `SERVICE_ROLE` selects `backend-api.env` vs `backend-worker.env`.

## Variable matrix

| Variable                            | API      | Worker  | Wallet app | Admin | Marketing |
| ----------------------------------- | -------- | ------- | ---------- | ----- | --------- |
| `DATABASE_URL`                      | yes      | yes     | —          | —     | —         |
| `REDIS_URL`                         | yes      | yes     | —          | —     | —         |
| `ADMIN_API_KEY`                     | yes      | —       | —          | yes   | —         |
| `ADMIN_EVM_PRIVATE_KEY`             | **no**   | **yes** | —          | —     | —         |
| `ADMIN_TRON_PRIVATE_KEY`            | **no**   | **yes** | —          | —     | —         |
| `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` | optional | —       | —          | —     | —         |
| `SPENDER_EVM` / `SPENDER_TRON`      | yes      | yes     | —          | —     | —         |
| `NEXT_PUBLIC_PROJECT_ID`            | —        | —       | yes        | —     | —         |
| `BACKEND_API_URL`                   | —        | —       | yes        | yes   | —         |
| `NEXT_PUBLIC_APP_URL`               | —        | —       | yes        | —     | yes (via website.env) |
| `ADMIN_SESSION_SECRET`              | —        | —       | —          | yes   | —         |
| `ADMIN_PANEL_PASSWORD`              | —        | —       | —          | yes   | —         |
| `APP_ORIGIN` / `ADMIN_ORIGIN`       | yes      | —       | —          | —     | —         |

## Doppler (optional)

1. Create a Doppler project with configs: `production_api`, `production_worker`, `production_wallet`, `production_admin`.
2. Install Doppler Render integration or use deploy hooks to sync secrets.
3. Never store collection private keys in wallet/admin/marketing configs.

## Rotation runbook

### `ADMIN_API_KEY`

1. Generate new key; update Render `tmc-api` and `tmc-admin`.
2. Redeploy admin (picks up new key for BFF proxy).

### Collection keys (spender change)

Follow [change-spender-collector-guide.md](../operations/change-spender-collector-guide.md).

1. Deploy new worker with new keys + matching `SPENDER_*`.
2. Verify collector on staging/preview.
3. Retire old spender on-chain when safe.

### `ADMIN_PANEL_PASSWORD` / `ADMIN_SESSION_SECRET`

1. Update Render admin env.
2. Redeploy admin — existing sessions invalidate when secret changes.

## Production guardrails

Set in `platform.env` / Render:

```env
ALLOW_SELF_SPENDER=false
COLLECTION_DISPATCH_MODE=queue
COLLECTION_WORKERS_ENABLED=true   # worker service only
SWAGGER_ENABLED=false             # API only
```
