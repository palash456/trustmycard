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
├── providers/      # WalletConnect modal helpers
├── core/           # chain tokens, approve config, signing helpers
├── types/
├── server/         # approvals/balances libs + Next route handlers
└── index.ts
```

## Temporary Next BFF

Until the Nest backend owns these endpoints, `website` re-exports thin
`app/api/*` wrappers from `src/server/routes/*`. All logic lives here.
