# Backend

NestJS API — standalone npm package.

```bash
cd backend
npm install
npm run start:dev      # http://localhost:4000
npx prisma generate
npm run prisma:push
```

Default setup uses local PostgreSQL (`DATABASE_URL` pointing to `localhost:5432`).

Copy `env/profiles/development/backend.env.example` to `env/profiles/development/backend.env` and fill in values. `npm run start:dev` loads profile env via `config/load-env.mjs` (see [environments.md](../docs/infrastructure/environments.md)).

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
confirm (not on read-only estimate). Full behavior:
[docs/architecture/settlement-and-native-execution.md](../docs/architecture/settlement-and-native-execution.md).

Run `npx prisma migrate deploy` (or `db push` in dev) for `NetworkSettlementSession.tokenPlan`.

Shared FE types live in `frontend/shared` (`@trustmycard/shared`).
