# Infrastructure

Deployment guides and reference configs for Trust My Card.

## Production (recommended)

| Guide | Description |
|-------|-------------|
| [render-hostinger-production.md](./render-hostinger-production.md) | **Primary** — Hostinger static marketing + Render core |
| [production-architecture.md](./production-architecture.md) | Blast-radius zones and signing boundary |
| [secrets.md](./secrets.md) | Env var matrix per service |
| [cloudflare-edge.md](./cloudflare-edge.md) | WAF and admin SSO (optional) |
| [disaster-recovery.md](./disaster-recovery.md) | Backups and rebuild runbook |

## Environments

| Guide | Description |
|-------|-------------|
| [environments.md](./environments.md) | Development, production-preview, production profiles |

## Legacy

| Guide | Description |
|-------|-------------|
| [hostinger-deployment.md](./hostinger-deployment.md) | All-in-one VPS (deprecated for new prod) |

## Reference configs

| Path | Purpose |
|------|---------|
| [render.yaml](../../render.yaml) | Render blueprint (API, workers, wallet, admin, Postgres, Redis) |
| [ecosystem.config.cjs](../../ecosystem.config.cjs) | PM2 for local/VPS all-in-one |
| [nginx/](./nginx/) | Nginx vhost templates (VPS) |
| [scripts/render-*.sh](../../scripts/) | Render build and migrate scripts |
