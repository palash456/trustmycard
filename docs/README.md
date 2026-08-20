# Trust My Card — Documentation

Product monorepo documentation. Start here for architecture, deployment, and operations.

> **Primary developer reference:** The Admin Panel includes a comprehensive, code-verified documentation site at **Admin → Documentation** (`/documentation`). Use that as the single source of truth for KT; this `docs/` folder retains deeper operational runbooks and historical references.

> **All terminal commands:** [COMMANDS.md](./COMMANDS.md) — local dev, tests, Docker VPS deploy (code / config / DB), runtime config, admin panel, VPS SSH. Mirrored in Admin → Documentation → **Command Reference**.

## Repository layout

```text
trustmycard/
├── backend/              # NestJS API + workers (own npm package)
├── frontend/
│   ├── marketing/        # Static marketing site → Hostinger (optional)
│   ├── website/          # Wallet app + BFF → VPS or Render
│   ├── admin/            # Ops console (local in production micro/budget)
│   ├── wallet-sdk/       # WalletConnect + approvals
│   └── shared/           # Shared types, constants, observability
├── deploy/               # Provider-independent Docker deploy (micro VPS + Caddy)
├── config/               # load-env.mjs + legacy platform.env
├── env/profiles/         # TMC_ENV profiles (development, production)
├── docs/                 # This folder
└── render.yaml           # Render blueprint (alternative to VPS)
```

## Quick start (local)

See **[COMMANDS.md](./COMMANDS.md)** for the full command reference. Essentials:

```bash
npm run setup:node_modules                          # from repo root — all packages
npm run setup && npm run setup:import               # env files (see environments.md)
cd frontend && npm run dev:website                  # :3000
cd backend && npm run start:dev                     # :4000
cd frontend && npm run dev:admin                    # :3002
```

Production push: `./deploy.sh production --provider=docker-vps`

## Packages

| Location              | Name                      | Role                                                                |
| --------------------- | ------------------------- | ------------------------------------------------------------------- |
| `frontend/marketing`  | `@trustmycard/marketing`  | Optional static marketing site (Hostinger)                          |
| `frontend/website`    | `@trustmycard/website`    | Wallet app + BFF; product at `/` (legacy `/connect` redirects)      |
| `frontend/admin`      | `@trustmycard/admin`      | Admin dashboard (local in production micro/budget)                  |
| `frontend/wallet-sdk` | `@trustmycard/wallet-sdk` | Wallet connect + approvals                                          |
| `frontend/shared`     | `@trustmycard/shared`     | FE types, constants, schemas, observability                         |
| `backend`             | `@trustmycard/backend`    | NestJS API (`SERVICE_ROLE=api`) and workers (`SERVICE_ROLE=worker`) |

## Production overview

| Surface    | Host             | URL                                  |
| ---------- | ---------------- | ------------------------------------ |
| Wallet app | VPS + Caddy TLS  | `exampleUrl.com` (product at `/`) |
| API        | VPS + Caddy TLS  | `api.exampleUrl.com`              |
| Data       | Neon + Upstash   | External Postgres + Redis            |
| Marketing  | Hostinger static | `www.exampleUrl.com` (optional)   |
| Admin      | Local machine    | `localhost:3002` against remote API  |

Deploy guides:

- **Micro VPS (current):** [deploy/README.md](../deploy/README.md)
- **Render budget:** [infrastructure/render-budget-production.md](./infrastructure/render-budget-production.md)
- **Render full:** [infrastructure/render-hostinger-production.md](./infrastructure/render-hostinger-production.md)

## Documentation index

### Architecture

| Doc                                                                                           | Description                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [architecture/README.md](./architecture/README.md)                                            | Index                                             |
| [settlement-and-native-execution.md](./architecture/settlement-and-native-execution.md)       | Two-phase settlement and native policy            |
| [event-driven-collection.md](./architecture/event-driven-collection.md)                       | Collection queue modes                            |
| [platform-configuration.md](./architecture/platform-configuration.md)                         | Platform env and spender config                   |
| [eligibility-layer.md](./architecture/eligibility-layer.md)                                   | Connect-flow minimum balance gate                 |
| [collection-rollout.md](./architecture/collection-rollout.md)                                 | Collection rollout stages                         |
| [semantic-ids.md](./architecture/semantic-ids.md)                                             | Journey `flow-*` IDs and child `publicId` formats |
| [approval-flow-three-way-comparison.md](./architecture/approval-flow-three-way-comparison.md) | Competitor vs TMC Old vs TMC Current              |
| [tron-approval-flow-comparison.md](./architecture/tron-approval-flow-comparison.md)           | HAR-based TRON comparison                         |

### Infrastructure

| Doc                                                                                 | Description                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [infrastructure/README.md](./infrastructure/README.md)                              | Index                                                 |
| [deploy/README.md](../deploy/README.md)                                             | **Micro VPS + Caddy TLS**                             |
| [render-budget-production.md](./infrastructure/render-budget-production.md)         | Budget deploy ~$14/mo                                 |
| [render-hostinger-production.md](./infrastructure/render-hostinger-production.md)   | Full deploy ~$60/mo (legacy layout)                   |
| [production-architecture.md](./infrastructure/production-architecture.md)           | Blast-radius zones                                    |
| [environments.md](./infrastructure/environments.md)                                 | `TMC_ENV` profiles                                    |
| [secrets.md](./infrastructure/secrets.md)                                           | Env var matrix per service                            |
| [mytrustvisa-domain-security.md](./infrastructure/mytrustvisa-domain-security.md)   | **Current production** domain & security              |
| [domain-migration-mytrustvisa.md](./infrastructure/domain-migration-mytrustvisa.md) | exampleUrl.com migration quick ref                 |
| [vps-migration.md](./infrastructure/vps-migration.md)                             | VPS moves (DO, Hetzner, FlokiNet, …), VPS → Render |
| [cloudflare-setup.md](./infrastructure/cloudflare-setup.md)                       | **Cloudflare DNS + proxy + WAF** for micro VPS      |
| [marketing-access.md](./infrastructure/marketing-access.md)                         | **Deprecated** — old `/connect` gate (archive linked) |
| [meta-ads-setup-guide.md](./marketing/meta-ads-setup-guide.md)                      | Meta / Instagram ads (media buyers)                   |
| [cloudflare-edge.md](./infrastructure/cloudflare-edge.md)                           | Legacy — see cloudflare-setup.md                      |
| [disaster-recovery.md](./infrastructure/disaster-recovery.md)                       | Backups and rebuild                                   |

### Operations

| Doc                                                                                 | Description                 |
| ----------------------------------------------------------------------------------- | --------------------------- |
| [COMMANDS.md](./COMMANDS.md)                                                         | **All terminal commands** — single source of truth |
| [operations/README.md](./operations/README.md)                                      | Index                       |
| [observability.md](./operations/observability.md)                                   | Logging, metrics, timelines |
| [change-spender-collector-guide.md](./operations/change-spender-collector-guide.md) | Spender/collector rotation  |
| [i18n-locale-sync.md](./operations/i18n-locale-sync.md)                               | Website locale sync workflow |
| [admin-pipeline-validation.md](./operations/admin-pipeline-validation.md)           | Post-deploy QA checklist    |

### API, database, security, testing

| Doc                                              | Description                          |
| ------------------------------------------------ | ------------------------------------ |
| [api/README.md](./api/README.md)                 | HTTP API reference                   |
| [database/README.md](./database/README.md)       | Prisma models index                  |
| [security/README.md](./security/README.md)       | Security boundaries and key handling |
| [testing/test-cases.md](./testing/test-cases.md) | Automated test catalog               |
| [adr/](./adr/)                                   | Architecture decision records        |

## Key conventions

- WalletConnect + approvals live in `frontend/wallet-sdk`. Website imports `<ConnectFlow />` only.
- Product lives at `/` on the wallet app. Legacy `/connect` redirects to `/`.
- Prisma schema: `backend/prisma/schema.prisma`
- Config profiles: `env/profiles/$TMC_ENV/` — see [environments.md](./infrastructure/environments.md)
- Marketing session gate removed — archive: https://github.com/palash456/trustmycard-marketing-gate-archive
- Local all-in-one (optional): `ecosystem.config.cjs` + `SERVICE_ROLE=all`
