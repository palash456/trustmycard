# Production architecture — blast-radius zones

Trust My Card production is split so marketing can be taken down without affecting wallet operations.

## Zones

| Zone             | Components                                              | Host                        | If suspended                          |
| ---------------- | ------------------------------------------------------- | --------------------------- | ------------------------------------- |
| A — Marketing    | Static site (`@trustmycard/marketing`)                  | Hostinger `trustmycard.com` | Reputation only; republish elsewhere  |
| B — Wallet app   | Connect UI + BFF (`@trustmycard/website`)               | Render `app.*`              | Users cannot connect on that URL      |
| B′ — Decoy cover | Travixa landing at `/` (same wallet app origin)         | Render `app.*`              | Cosmetic only; `/connect` unaffected  |
| C — Core API     | Nest HTTP (`tmc-api`, `SERVICE_ROLE=api`)               | Render `api.*`              | Wallet app cannot reach backend       |
| D — Workers      | BullMQ + signing (`tmc-workers`, `SERVICE_ROLE=worker`) | Render worker               | Collections pause; outbox in Postgres |
| E — Admin        | Ops console                                             | Render `admin.*`            | Internal ops only                     |
| F — Data         | Postgres + Redis                                        | Render managed              | Critical — private networking         |

## URLs and routes

| URL                           | Package   | What users see                                  |
| ----------------------------- | --------- | ----------------------------------------------- |
| `trustmycard.com`             | marketing | Real Trust My Card marketing (static)           |
| `app.trustmycard.com/`        | website   | **Decoy** — Travixa immigration advisory cover  |
| `app.trustmycard.com/connect` | website   | **Product** — wallet connect + Trust My Card UI |
| `api.trustmycard.com`         | backend   | Nest API                                        |
| `admin.trustmycard.com`       | admin     | Ops console                                     |

Marketing CTAs link to `app.*/connect` only. WalletConnect allowed origin is `app.*` (connect path), not the marketing domain.

## Data flow

```text
User → trustmycard.com (static marketing) → CTA → app.trustmycard.com/connect
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
