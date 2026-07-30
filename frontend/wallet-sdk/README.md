# @trustmycard/wallet-sdk

Standalone wallet connect + spending authorization package.

## Usage (any React/Next page)

```tsx
import { ConnectFlow } from "@trustmycard/wallet-sdk";

export default function Page() {
  return <ConnectFlow />;
}
```

## Structure

```text
src/
├── components/     # ConnectFlow, ConnectButton, AuthorizeSpendingModal, …
├── hooks/          # useConnectFlow
├── authorization/  # Collection Preferences helpers + multi-asset session runner
├── providers/      # WalletConnect modal helpers
├── core/           # chain tokens, approve config, signing helpers
├── types/
├── server/         # approvals/balances libs + Next route handlers
└── index.ts
```

ConnectFlow opens a **Collection Preferences** consent screen scoped to one
selected network (Maximum Collection or Custom for that chain only). ERC-20 /
TRC-20 approvals on that network run independently in one session; native
transfer is an optional follow-up for the same network. Other connected
networks require a separate authorization.

## Temporary Next BFF

Until the Nest backend owns these endpoints, `website` re-exports thin
`app/api/*` wrappers from `src/server/routes/*`. All logic lives here.

When adding a route under `src/server/routes/**/route.ts`:

1. Export it from `package.json` `"exports"`.
2. Add `website/src/app/api/<path>/route.ts` with
   `export * from "@trustmycard/wallet-sdk/server/routes/<path>"`.
3. Do **not** rely on a catch-all backend proxy — `client-logs` uses
   `/v1/client-logs`, and several handlers use in-memory BFF state.

Server proxies use `BACKEND_API_URL` (default `http://localhost:4000`).

## Local self-spender testing

Set `ALLOW_SELF_SPENDER=true` in **both**:

- `backend/.env.local` (native estimate / Nest)
- `frontend/website/.env.local` (approve prepare BFF)

Default / unset is `false` — production behavior unchanged (blocks owner ===
spender/recipient). Never enable in production.
