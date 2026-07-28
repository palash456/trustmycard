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
npm run dev:website   # :3000
npm run dev:admin     # :3002
npm run dev:sdk       # wallet-sdk watch
npm run dev:stop      # kill stale dev servers
```

## Separation rule

- **`website`** — pages, layout, marketing content. Imports wallet UI from the SDK.
- **`wallet-sdk`** — WalletConnect, authorize modal, hooks, chain helpers, temporary Next API handlers.

```tsx
import { ConnectFlow } from "@trustmycard/wallet-sdk";
```
