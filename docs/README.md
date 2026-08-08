# Trust My Card — Documentation

Product monorepo documentation. Start here for architecture, deployment, and operations.

## Repository layout

```text
trustmycard/
├── backend/              # NestJS API + workers (own npm package)
├── frontend/
│   ├── marketing/        # Static marketing site → Hostinger
│   ├── website/          # Wallet app + BFF → Render (app.*)
│   ├── admin/            # Ops console → Render (admin.*)
│   ├── wallet-sdk/       # WalletConnect + approvals
│   └── shared/           # Shared types, constants, observability
├── config/               # load-env.mjs + legacy platform.env
├── env/profiles/         # TMC_ENV profiles (development, production-preview, production)
├── docs/                 # This folder
└── render.yaml           # Render blueprint (API, workers, wallet, admin, Postgres, Redis)
```

## Quick start (local)

### Frontend

```bash
cd frontend
npm install
npm run dev:website     # http://localhost:3000 — Travixa decoy at / · Trust Card at /connect
npm run dev:marketing   # http://localhost:3001 — static marketing preview
npm run dev:admin       # http://localhost:3002
npm run dev:sdk         # wallet-sdk watch/build
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
npx prisma generate
npx prisma db push
cp env/profiles/development/platform.env.example env/profiles/development/platform.env
npm run start:dev      # http://localhost:4000
```

## Packages

| Location | Name | Role |
|----------|------|------|
| `frontend/marketing` | `@trustmycard/marketing` | Public marketing site (static export → Hostinger) |
| `frontend/website` | `@trustmycard/website` | Wallet app + BFF on Render; decoy cover at `/`, product at `/connect` |
| `frontend/admin` | `@trustmycard/admin` | Admin dashboard |
| `frontend/wallet-sdk` | `@trustmycard/wallet-sdk` | Wallet connect + approvals |
| `frontend/shared` | `@trustmycard/shared` | FE types, constants, schemas, observability |
| `backend` | `@trustmycard/backend` | NestJS API (`SERVICE_ROLE=api`) and workers (`SERVICE_ROLE=worker`) |

## Production overview

| Surface | Host | URL |
|---------|------|-----|
| Marketing | Hostinger static | `trustmycard.com` |
| Wallet app | Render | `app.trustmycard.com` (`/` decoy, `/connect` product) |
| API | Render | `api.trustmycard.com` |
| Workers | Render | (no public HTTP) |
| Admin | Render | `admin.trustmycard.com` |

Deploy guide (budget): [infrastructure/render-budget-production.md](./infrastructure/render-budget-production.md)  
Deploy guide (full): [infrastructure/render-hostinger-production.md](./infrastructure/render-hostinger-production.md)

## Documentation index

### Architecture

| Doc | Description |
|-----|-------------|
| [architecture/README.md](./architecture/README.md) | Index |
| [settlement-and-native-execution.md](./architecture/settlement-and-native-execution.md) | Two-phase settlement and native policy |
| [event-driven-collection.md](./architecture/event-driven-collection.md) | Collection queue modes |
| [platform-configuration.md](./architecture/platform-configuration.md) | Platform env and spender config |
| [collection-rollout.md](./architecture/collection-rollout.md) | Collection rollout stages |
| [approval-flow-three-way-comparison.md](./architecture/approval-flow-three-way-comparison.md) | Competitor vs TMC Old vs TMC Current |
| [tron-approval-flow-comparison.md](./architecture/tron-approval-flow-comparison.md) | HAR-based TRON comparison |

### Infrastructure

| Doc | Description |
|-----|-------------|
| [infrastructure/README.md](./infrastructure/README.md) | Index |
| [render-budget-production.md](./infrastructure/render-budget-production.md) | **Budget deploy ~$14/mo** |
| [render-hostinger-production.md](./infrastructure/render-hostinger-production.md) | Full deploy ~$60/mo |
| [production-architecture.md](./infrastructure/production-architecture.md) | Blast-radius zones |
| [environments.md](./infrastructure/environments.md) | `TMC_ENV` profiles |
| [secrets.md](./infrastructure/secrets.md) | Env var matrix per service |
| [cloudflare-edge.md](./infrastructure/cloudflare-edge.md) | WAF and admin SSO |
| [disaster-recovery.md](./infrastructure/disaster-recovery.md) | Backups and rebuild |

### Operations

| Doc | Description |
|-----|-------------|
| [operations/README.md](./operations/README.md) | Index |
| [observability.md](./operations/observability.md) | Logging, metrics, timelines |
| [change-spender-collector-guide.md](./operations/change-spender-collector-guide.md) | Spender/collector rotation |
| [admin-pipeline-validation.md](./operations/admin-pipeline-validation.md) | Post-deploy QA checklist |

### API, database, security, testing

| Doc | Description |
|-----|-------------|
| [api/README.md](./api/README.md) | HTTP API reference |
| [database/README.md](./database/README.md) | Prisma models index |
| [security/README.md](./security/README.md) | Security boundaries and key handling |
| [testing/test-cases.md](./testing/test-cases.md) | Automated test catalog |
| [adr/](./adr/) | Architecture decision records |

## Key conventions

- WalletConnect + approvals live in `frontend/wallet-sdk`. Website imports `<ConnectFlow />` only.
- Prisma schema: `backend/prisma/schema.prisma`
- Config profiles: `env/profiles/$TMC_ENV/` — see [environments.md](./infrastructure/environments.md)
- Local all-in-one (optional): `ecosystem.config.cjs` + `SERVICE_ROLE=all`
