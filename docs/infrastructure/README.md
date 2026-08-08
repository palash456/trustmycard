# Infrastructure

Deployment guides and environment reference for Trust My Card production.

## Production deploy

| Guide | Description |
|-------|-------------|
| [render-hostinger-production.md](./render-hostinger-production.md) | **Start here** — Hostinger static marketing + Render core |
| [production-architecture.md](./production-architecture.md) | Blast-radius zones, decoy layer, signing boundary |
| [secrets.md](./secrets.md) | Env var matrix per Render service |
| [cloudflare-edge.md](./cloudflare-edge.md) | WAF and admin SSO (optional) |
| [disaster-recovery.md](./disaster-recovery.md) | Backups and rebuild runbook |

## Environments

| Guide | Description |
|-------|-------------|
| [environments.md](./environments.md) | `TMC_ENV` profiles: development, production-preview, production |

## Repo configs

| Path | Purpose |
|------|---------|
| [render.yaml](../../render.yaml) | Render blueprint (API, workers, wallet app, admin, Postgres, Redis) |
| [ecosystem.config.cjs](../../ecosystem.config.cjs) | PM2 all-in-one for local dev or legacy VPS |
| [scripts/render-*.sh](../../scripts/) | Render build and migrate scripts |
| [env/profiles/](../../env/profiles/) | Profile env templates (`platform`, `backend-api`, `backend-worker`, `website`, `marketing`, `admin`) |

Marketing is **not** on Render — static files upload to Hostinger only. See section 8 of [render-hostinger-production.md](./render-hostinger-production.md).
