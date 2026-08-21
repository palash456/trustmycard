# Frontend

Single npm workspace for all frontend packages.

```text
frontend/
├── website/         # @trustmycard/website — public Next.js site
├── admin/           # @trustmycard/admin — admin dashboard
├── wallet-sdk/      # @trustmycard/wallet-sdk — wallet integration
├── shared/          # @trustmycard/shared — types, constants, schemas
└── scripts/         # dev helpers (stop-dev)
```

## Commands

Run from **`frontend/`** (or from repo root: `npm run setup:node_modules` installs here + backend):

```bash
npm install
npm run dev:website   # TMC_ENV=development, :3000
npm run dev:admin     # TMC_ENV=development, :3002
npm run dev:sdk       # wallet-sdk watch
npm run dev:stop      # kill stale dev servers
```

Environment profiles live under `env/profiles/$TMC_ENV/`. Set `BACKEND_API_URL` in the active profile or `website/.env.local` (default `http://127.0.0.1:4000`).

## Separation rule

- **`website`** — pages, layout, marketing content. Imports wallet UI from the SDK.
- **`wallet-sdk`** — WalletConnect, authorize modal, two-phase authorization
  (wallet phase + background settlement), hooks, chain helpers, temporary Next API handlers.

Two-phase flow and native execution policy are implemented in `wallet-sdk/authorization/` and backend `NetworkSettlementService`.

```tsx
import { ConnectFlow } from "@trustmycard/wallet-sdk";
```
