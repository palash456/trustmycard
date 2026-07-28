# Backend

NestJS API — standalone npm package.

```bash
cd backend
npm install
npm run start:dev      # http://localhost:4000
docker compose up -d   # Postgres + Redis
```

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

Shared FE types live in `frontend/shared` (`@trustmycard/shared`). When the backend needs those contracts, add `"@trustmycard/shared": "file:../frontend/shared"` to `package.json`.
