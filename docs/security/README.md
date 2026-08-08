# Security

Security boundaries, custody model, and key handling for Trust My Card.

## Custody and signing

| Asset | Where it lives | Notes |
|-------|----------------|-------|
| User wallet keys | User device only | Never transmitted or stored |
| Collection signing keys | `tmc-workers` only (`SERVICE_ROLE=worker`) | `ADMIN_EVM_PRIVATE_KEY`, `ADMIN_TRON_PRIVATE_KEY` |
| Spender addresses | API + workers (public) | `SPENDER_EVM`, `SPENDER_TRON` in platform profile |
| TRON energy delegator | API optional | `TRON_ENERGY_DELEGATOR_PRIVATE_KEY` — smaller scope than collection keys |
| Admin API key | API + admin services | Rotatable; never in frontend bundles |
| Admin session | Admin service | `ADMIN_SESSION_SECRET`, `ADMIN_PANEL_PASSWORD` |

The API service (`SERVICE_ROLE=api`) **must not** have collection private keys in production. See [secrets.md](../infrastructure/secrets.md).

## Application security (production)

Configured in backend and Render env:

- **Helmet** — security headers on API
- **CORS** — `APP_ORIGIN` / `ADMIN_ORIGIN` allowlists
- **Rate limiting** — throttler on API; login rate limit on admin
- **Swagger** — disabled in production (`SWAGGER_ENABLED=false`)
- **Metrics** — guarded admin endpoint
- **Legacy admin transfer** — disabled in production

## Admin access

- Session-based auth on `admin.*`
- Optional [Cloudflare Access](../infrastructure/cloudflare-edge.md) in front of admin hostname
- Audit log for admin mutations (`AuditLog` model)

## Observability redaction

Never log private keys, mnemonics, API keys, JWT/session tokens, or raw signed tx hex. See [operations/observability.md](../operations/observability.md).

## Related docs

- [Production architecture](../infrastructure/production-architecture.md) — blast-radius zones
- [Secrets matrix](../infrastructure/secrets.md) — per-service env vars
- [Change spender/collector guide](../operations/change-spender-collector-guide.md) — key rotation runbook
- [Disaster recovery](../infrastructure/disaster-recovery.md) — backup and rebuild
