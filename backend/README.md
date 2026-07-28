# Backend

NestJS API — standalone npm package.

```bash
cd backend
npm install
npm run start:dev      # http://localhost:4000
npx prisma generate
npx prisma db push
```

Default setup now uses local SQLite (`DATABASE_URL="file:./dev.db"`), so Docker/Postgres is optional.

## Layout

```text
backend/
├── src/
│   ├── modules/         # Domain + custody + blockchain providers
│   ├── infrastructure/
│   ├── common/
│   ├── config/
│   └── jobs/
├── prisma/
└── docker-compose.yml
```

## Wallet API migration

- Wallet routes are now served by backend under `v1/api/*` (balances, approvals, tron broadcast, allowance verify, tg-log, etc.).
- Website `src/app/api/*` is a thin proxy to backend.
- Swagger UI is available at `http://localhost:4000/v1/docs`.

Shared FE types live in `frontend/shared` (`@trustmycard/shared`).
