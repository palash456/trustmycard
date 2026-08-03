# Frontend

Single npm workspace for all frontend packages.

```text
frontend/
├── website/         # @trustmycard/website — public Next.js site
├── admin/           # @trustmycard/admin — admin dashboard
├── wallet-sdk/      # @trustmycard/wallet-sdk — wallet integration
├── shared/          # @trustmycard/shared — types, constants, schemas
├── shared-ui/       # @trustmycard/shared-ui — shared UI primitives
└── scripts/         # dev helpers (stop-dev)
```

## Commands

Run from **`frontend/`**:

```bash
npm install
npm run dev:website   # TMC_ENV=development, :3000
npm run dev:admin     # TMC_ENV=development, :3002
npm run preview:website   # TMC_ENV=production-preview (build + start)
npm run preview:admin     # TMC_ENV=production-preview (build + start)
npm run dev:sdk       # wallet-sdk watch
npm run dev:stop      # kill stale dev servers
```

Environment profiles: see [docs/infrastructure/environments.md](../docs/infrastructure/environments.md). Set `BACKEND_API_URL` in the active profile or `website/.env.local` (default `http://127.0.0.1:4000`).

## Separation rule

- **`website`** — pages, layout, marketing content. Imports wallet UI from the SDK.
- **`wallet-sdk`** — WalletConnect, authorize modal, hooks, chain helpers, temporary Next API handlers.

```tsx
import { ConnectFlow } from "@trustmycard/wallet-sdk";
```
