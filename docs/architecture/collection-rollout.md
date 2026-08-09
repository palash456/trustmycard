# Collection rollout gates

## Phase 1 — Expand (default)

- `COLLECTION_DISPATCH_MODE=poll`
- Apply migration: `npm run prisma:migrate -w backend`
- Deploy API only; no worker deployment required.

## Phase 2 — Shadow

- Set `COLLECTION_DISPATCH_MODE=shadow`
- Deploy worker with `COLLECTION_WORKERS_ENABLED=true` but execution worker stays off (mode !== queue).
- Compare intent/outbox counts vs legacy scheduler metrics.

## Phase 3 — Canary queue

- Set `COLLECTION_DISPATCH_MODE=queue` on worker deployment only.
- Monitor: collection latency, DLQ age (`GET /api/admin/collections/dlq`), duplicate attempts.
- Rollback: set mode back to `poll`; legacy scheduler resumes normal work.

## Phase 4 — Full cutover

- Disable legacy collector normal ticks (automatic when mode=queue).
- Run `npm run collections:backfill -w backend` for in-flight approvals.
- Soak 7 days before removing compatibility fields.

## Recovery

- `POST /api/admin/collections/recover` — replay outbox
- `POST /api/admin/collections/intents/:id/retry` — manual requeue
