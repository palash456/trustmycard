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
| `/activity` | Fixed tab filters; sessions tab uses timelines API; **settlement** module in journey feed |
| `/dashboard` | Recent structured errors widget; **settlement** session counts |
| `/system` | Runtime metrics panel |
| `/users/[address]` | Logs tab with observability + audit; **Settlement** tab with live token states |
| `/pipeline`, entity details | View logs cross-links; background/native settlement stages |
| `/settings` | Recent settings audit entries |
| `/events` | Redirects to `/activity` |

## Settlement observability

Two-phase authorization surfaces in admin via:

- **Activity feed** — `module: settlement`, friendly labels from
  `NETWORK_SETTLEMENT_STATUS_LABELS` and settlement progress stages
- **User detail → Settlement** — `SettlementSessionsPanel` shows per-token
  logical states (`tokenReadiness`) and native **can execute** vs **waiting
  for active collection**
- **Dashboard** — active/failed settlement session counts
- **API** — `GET /admin/settlement-sessions`, `GET /admin/settlement-sessions/:id`

Policy reference: [settlement-and-native-execution.md](../architecture/settlement-and-native-execution.md).

## Intentionally unchanged

- `/login`, `/` — auth only, no operational data
- Revenue/analytics aggregates — remain Prisma-derived (not log-derived)
- Backend Pino stdout — requires external log aggregator for search

## Client pipeline

- `POST /api/client-logs` proxy in wallet-sdk forwards browser logs to backend
- Connect, approval, and post-confirm flows emit via `createLogger`
- Full log payload persisted including error, context, and sampling metadata
