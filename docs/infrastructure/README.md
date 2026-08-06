# Infrastructure

Nginx configs and deployment guides for Trust My Card.

## Guides

| Guide | Description |
|-------|-------------|
| [environments.md](./environments.md) | Development, production-preview, and production profiles (`TMC_ENV`) |
| [hostinger-deployment.md](./hostinger-deployment.md) | Full VPS deploy: website, admin, API, PostgreSQL, Redis, Nginx, SSL |

## Reference configs (committed)

| Path | Purpose |
|------|---------|
| [ecosystem.config.cjs](../../ecosystem.config.cjs) | PM2 process list (`TMC_ENV=production`) |
| [nginx/](./nginx/) | Nginx vhost templates |
