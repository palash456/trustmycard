# @trustmycard/shared

Platform-wide types, constants, and schemas for frontend packages.

```text
frontend/shared/
├── types/
├── constants/
│   ├── collection.ts              # skip reasons, collection helpers
│   ├── settlement.ts              # TOKEN_SETTLEMENT_ORDER, status labels
│   └── token-collection-state.ts  # native execution policy (logical states)
└── schemas/
```

```ts
import type { ApiErrorBody } from "@trustmycard/shared/types";
import { API_VERSION } from "@trustmycard/shared/constants";
import {
  resolveTokenCollectionState,
  canExecuteNativeFromStates,
  TOKEN_COLLECTION_STATE_LABELS,
} from "@trustmycard/shared/constants/token-collection-state";
```

## Token collection state (native policy)

`constants/token-collection-state.ts` is the **canonical** definition for when
native may execute. Used by:

- Backend `WalletService.evaluateNativeReadiness()`
- Wallet-sdk settlement coordinator (via API)
- Admin token state labels

Logical states: `pending`, `collecting`, `success`, `skipped_zero_balance`,
`failed_permanent`, `failed_retry_scheduled`, `cancelled`.

Native runs when **every** token is non-active (not pending/collecting).

Build before running shared tests:

```bash
cd frontend/shared
npm run build
node --test test/token-collection-state.spec.js
```

Install from the frontend workspace root:

```bash
cd frontend
npm install
```

See [settlement-and-native-execution.md](../../docs/architecture/settlement-and-native-execution.md).

Test catalog: [docs/testing/test-cases.md](../../docs/testing/test-cases.md).
