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

Copy `.env.example` to `.env.local` (or `.env`) and fill in values. On boot, the API loads `.env` then `.env.local` (local overrides).

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

Shared FE types live in `frontend/shared` (`@trustmycard/shared`).
