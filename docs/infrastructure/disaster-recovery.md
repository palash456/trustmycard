# Disaster recovery

## RPO / RTO targets (recommended)

| Resource         | RPO                   | RTO                          |
| ---------------- | --------------------- | ---------------------------- |
| PostgreSQL       | ≤ 5 min (PITR)        | ≤ 4 hours                    |
| Redis            | N/A (ephemeral queue) | Rebuild empty; replay outbox |
| Render services  | N/A                   | ≤ 2 hours with `render.yaml` |
| Marketing static | N/A                   | ≤ 30 min (re-upload `out/`)  |

## PostgreSQL

1. Enable **Point-in-Time Recovery** on Render Postgres (or use Neon/RDS with PITR).
2. Weekly logical backup: `pg_dump` to S3 (separate cloud account).
3. **Quarterly restore drill**: restore to staging, run `npm test` in backend.

## Redis

BullMQ queues are **not** the source of truth. Collection state lives in Postgres (`CollectionIntent`, `OutboxEvent`). If Redis is lost:

1. Redeploy Redis service.
2. Workers reconnect; recovery scheduler republishes pending outbox rows.

## Render rebuild

1. Clone repo; apply `render.yaml` blueprint on new Render account if needed.
2. Restore secrets from Doppler backup or secure vault.
3. Run `./scripts/render-migrate.sh` against new database (if fresh) or restored DB.
4. Deploy order: **workers → API → wallet app → admin**.
5. Update DNS for `api`, `app`, `admin` to new Render endpoints.

## Marketing failover

1. Keep a second Hostinger account or Cloudflare Pages project with the same `out/` artifact.
2. Pre-stage DNS for backup domain (`trustmycard.io`).
3. Flip A/CNAME records; core wallet stack unaffected.

## Signing keys

- Store key ceremony documentation offline (who generated, when rotated).
- Worker env is rebuilt from vault — never rely on Render dashboard as sole copy.

## Incident checklist

1. Confirm workers running: Render dashboard → `tmc-workers` logs.
2. Check collection health: admin → Collections status / DLQ.
3. Verify Postgres connectivity: `TMC_ENV=production npm run prisma:status --prefix backend`.
4. If API compromised: rotate `ADMIN_API_KEY`, redeploy, review audit logs.
