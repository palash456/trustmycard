# Admin Observability Migration

Completed wiring of the observability system across the admin panel.

## Log sources

| Source | Admin API | Primary use |
|--------|-----------|-------------|
| `AuditLog` | `GET /v1/api/admin/audit-logs` | Admin mutations, wallet prepare/confirm |
| `TgLogEvent` | `GET /v1/api/admin/tg-events` | Connect/approve/transfer flow alerts |
| `ObservabilityEvent` | `GET /v1/api/admin/observability/events` | Structured client logs |
| Session timelines | `GET /v1/api/admin/sessions/:sessionId/timeline` | Authorization journey |
| Metrics | `GET /v1/api/admin/metrics` | Counters, latency histograms |

## Deep-link conventions

- `/audit?tab=admin|structured|timelines`
- `walletAddress`, `sessionId`, `traceId`, `correlationId`, `txHash`, `search`, `from`, `to`, `entityType`, `module`, `level`

## Pages updated

| Area | Changes |
|------|---------|
| `/audit` | Unified 3-tab explorer with search, filters, pagination |
| `/audit/timeline/[sessionId]` | Session timeline detail view |
| `/activity` | Fixed tab filters; sessions tab uses timelines API |
| `/dashboard` | Recent structured errors widget |
| `/system` | Runtime metrics panel |
| `/users/[address]` | Logs tab with observability + audit |
| `/pipeline`, entity details | View logs cross-links |
| `/settings` | Recent settings audit entries |
| `/events` | Redirects to `/activity` |

## Intentionally unchanged

- `/login`, `/` — auth only, no operational data
- Revenue/analytics aggregates — remain Prisma-derived (not log-derived)
- Backend Pino stdout — requires external log aggregator for search

## Client pipeline

- `POST /api/client-logs` proxy in wallet-sdk forwards browser logs to backend
- Connect, approval, and post-confirm flows emit via `createLogger`
- Full log payload persisted including error, context, and sampling metadata
