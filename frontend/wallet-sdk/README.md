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
├── authorization/  # Two-phase session + settlement coordinator
│   ├── session.ts              # Wallet phase (user-visible)
│   └── phases/
│       └── settlement-coordinator.ts  # Background USDT→USDC→native
├── providers/      # WalletConnect modal helpers
├── core/           # chain tokens, approve config, signing helpers
├── native-transfer/  # EVM send + Tron deferred native
├── observability/  # connect-logger, structured client logs
├── eligibility/    # Pre-authorization minimum-balance checks
├── types/
├── server/         # approvals/balances libs + Next route handlers
└── index.ts
```

## Two-phase authorization

ConnectFlow opens a **Collection Preferences** consent screen scoped to one
selected network (Maximum Collection or Custom for that chain only).

### Wallet phase

ERC-20 / TRC-20 approvals run in **USDT → USDC** order for the selected
network. The user sees “connected” when this phase completes.

- **EVM:** token approves only; native is **deferred** to settlement
  (`eth_sendTransaction`, not `personal_sign`).
- **Tron:** USDT → USDC → native **sign** in wallet phase; broadcast is
  deferred to settlement.

Zero-balance tokens may still approve on-chain; `shouldAttemptTransfer: false`
is captured for settlement.

### Background settlement

After wallet phase, `runAuthorizationSettlement`:

1. Registers `NetworkSettlementSession` on the backend (includes `tokenPlan`).
2. Finalizes each approval (confirm → `CollectionIntent`).
3. Polls `POST /api/token-collection/native-readiness` until no token has
   **active** collection (pending/collecting).
4. Executes native (Tron server broadcast or EVM wallet send).

**Native policy:** failures, zero-balance skips, and retry-scheduled states do
**not** block native — only in-flight collection does. See
`@trustmycard/shared/constants/token-collection-state`.

Progress is logged via `SETTLEMENT PROGRESS` / `NATIVE_READINESS_POLL` in
`connect-logger.ts` (admin activity + terminal in dev).

Other connected networks require a separate authorization.

## Eligibility

Before authorization, the connect flow requires an explicit **Check Eligibility**
step in `LinkNetworkModal`.

- `src/eligibility/types.ts` — asset/network eligibility types
- `src/eligibility/eligibility-config.ts` — per-network env var resolution
- `src/eligibility/eligibility-service.ts` — pure BigInt balance comparison
- `useConnectFlow.checkEligibility()` — fresh balance fetch + evaluate all networks (also used by footer **Refresh Balances**)

Only assets with `ELIGIBLE` state are forwarded to `runAuthorizationSession`.
See `src/eligibility/eligibility-service.ts`.

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

## Tests

```bash
cd frontend/wallet-sdk
node --test -r ./test/register-ts.cjs test/authorization/*.spec.ts
```

Notable specs: `native-readiness-poll.spec.ts`, `balance-scenarios.spec.ts`,
`wallet-phase.spec.ts`.
