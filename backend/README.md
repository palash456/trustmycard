# Backend

NestJS API — standalone npm package.

## Local development (native — no Docker)

All services run on the host:

| Service | URL / port |
|---------|------------|
| API | `http://127.0.0.1:4000` |
| Website | `http://localhost:3000` |
| Admin | `http://localhost:3002` |
| PostgreSQL | `localhost:5432` (`DATABASE_URL`) |
| Redis | `127.0.0.1:6379` (`REDIS_URL`) |

```bash
# From repo root — first time
npm run setup
npm run setup:local-deps    # macOS: Homebrew Postgres + Redis
cd backend && npm run prisma:push

cd backend && npm run start:dev
cd frontend && npm run dev:website
cd frontend && npm run dev:admin
```

`npm run start:dev` probes native Postgres and Redis before starting (skip with `TMC_SKIP_DEV_DEPS=1`).

Copy `env/profiles/development/backend.env.example` to `env/profiles/development/backend.env`. Env is loaded via `config/load-env.mjs`.

**Docker** is used only for production builds and deployment (`deploy/`, `deploy.sh`). It is not required for local development.

## Layout

```text
backend/
├── src/
│   ├── modules/         # Domain + custody + blockchain providers
│   ├── infrastructure/
│   ├── common/
│   ├── config/
│   └── jobs/
└── prisma/
```

## Wallet API migration

- Wallet routes are now served by backend under `v1/api/*` (balances, approvals, tron broadcast, allowance verify, tg-log, etc.).
- Website `src/app/api/*` is a thin proxy to backend.
- Swagger UI is available at `http://localhost:4000/v1/docs`.

### Settlement & native readiness

Two-phase authorization uses `NetworkSettlementService` and
`WalletService.evaluateNativeReadiness()`:

| Endpoint                                         | Role                                      |
| ------------------------------------------------ | ----------------------------------------- |
| `POST /v1/api/network-settlement/register`       | Wallet phase complete; stores `tokenPlan` |
| `POST /v1/api/token-collection/native-readiness` | Blocks native only on active collection   |
| `POST /v1/api/network-settlement/process`        | Tron deferred broadcast / EVM ready       |
| `GET /v1/api/network-settlement/:id/status`      | Session + per-token logical states        |

Native estimate/register paths call `assertNativeExecutionAllowed()` on register and
confirm (not on read-only estimate). See `NetworkSettlementService` and `WalletService.evaluateNativeReadiness()`.

Run `npx prisma migrate deploy` (or `db push` in dev) for `NetworkSettlementSession.tokenPlan`.

Shared FE types live in `frontend/shared` (`@trustmycard/shared`).
