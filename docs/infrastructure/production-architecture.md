# Production architecture — blast-radius zones

Trust My Card production is split so marketing can be taken down without affecting wallet operations.

## Zones

| Zone | Components | Host | If suspended |
|------|------------|------|--------------|
| A — Marketing | Static site (`@trustmycard/marketing`) | Hostinger static | Reputation only; republish elsewhere |
| B — Wallet app | Connect UI + BFF (`@trustmycard/website`) | Render `app.*` | Users cannot start new connects on that URL |
| C — Core API | Nest HTTP (`tmc-api`) | Render `api.*` | Wallet app cannot reach backend |
| D — Workers | BullMQ + signing (`tmc-workers`) | Render worker | Collections pause; funds not lost (outbox in Postgres) |
| E — Admin | Ops console | Render `admin.*` | Internal ops only |
| F — Data | Postgres + Redis | Render managed | Critical — protect with private networking |

## Data flow

```text
User → trustmycard.com (static) → link → app.trustmycard.com/connect
app.* BFF /api/* → Nest api.* → Postgres / Redis
tmc-workers → Postgres / Redis → blockchain RPC (outbound)
```

## Signing boundary

- **Collection keys** (`ADMIN_EVM_PRIVATE_KEY`, `ADMIN_TRON_PRIVATE_KEY`) exist **only** on `tmc-workers` (`SERVICE_ROLE=worker`, `COLLECTION_SIGNING_ENABLED=true`).
- **API** (`SERVICE_ROLE=api`) enqueues collection intents; workers sign `transferFrom`.
- **TRON energy delegation** may use `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` on API only (smaller blast radius).

## Related guides

- [render-hostinger-production.md](./render-hostinger-production.md) — step-by-step deploy
- [secrets.md](./secrets.md) — env var matrix
- [cloudflare-edge.md](./cloudflare-edge.md) — WAF and admin SSO
- [disaster-recovery.md](./disaster-recovery.md) — backups and rebuild

Legacy monolith VPS guide: [hostinger-deployment.md](./hostinger-deployment.md) (deprecated for new production).
