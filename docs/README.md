# Trust My Card

Product monorepo with three top-level areas:

```text
trustmycard/
├── backend/     # NestJS API (own npm)
├── frontend/    # Website, admin, wallet SDK (shared npm workspaces)
└── docs/        # Architecture, API, security, ADRs
```

## Quick start

### Frontend (website, admin, wallet SDK)

```bash
cd frontend
npm install
npm run dev:website    # http://localhost:3000
npm run dev:admin      # http://localhost:3002
npm run dev:sdk        # wallet-sdk watch/build
```

If a dev server gets stuck:

```bash
cd frontend
npm run dev:stop
npm run dev:website:reset
```

### Backend

```bash
cd backend
npm install
npm run start:dev      # http://localhost:4000
```

Local Postgres + Redis:

```bash
cd backend
docker compose up -d
```

## Packages

| Location | Name | Role |
|----------|------|------|
| `frontend/website` | `@trustmycard/website` | Public marketing site |
| `frontend/admin` | `@trustmycard/admin` | Admin dashboard |
| `frontend/wallet-sdk` | `@trustmycard/wallet-sdk` | Wallet connect + approvals |
| `frontend/shared` | `@trustmycard/shared` | FE types, constants, schemas |
| `frontend/shared-ui` | `@trustmycard/shared-ui` | Shared UI primitives |
| `backend` | `@trustmycard/backend` | NestJS API |

## Notes

- WalletConnect + approvals live in `frontend/wallet-sdk`. Website imports `<ConnectFlow />` only.
- Prisma models: `backend/prisma/schema.prisma`
- Architecture decisions: `docs/adr/`
