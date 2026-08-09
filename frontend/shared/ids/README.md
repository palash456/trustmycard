# Semantic IDs

Canonical rules for **business-facing identifiers** across wallet-sdk, backend, and admin.

Import from `@trustmycard/shared/ids` (build `frontend/shared` first).

```ts
import {
  generateFlowId,
  generatePublicId,
  isFlowId,
  tokenQualifier,
} from "@trustmycard/shared/ids";
```

## ID hierarchy

| Layer | Column / field | Format | Purpose |
|-------|----------------|--------|---------|
| **Journey** | `traceId`, `clientSessionId`, `transactionId` | `flow-*` | One end-to-end user attempt (scan → settlement) |
| **Child record** | `publicId` | `approval-usdt-*`, `transfer-*`, … | Human-readable ID for a single entity within a journey |
| **Internal** | `id` (Prisma CUID) | opaque | Database primary key — not shown as the primary admin label when `publicId` exists |
| **On-chain** | `txHash` | `0x…` / Tron hash | Blockchain transaction reference — separate from journey IDs |

**Status is never encoded in IDs.** Terminal state lives on records and in observability events.

## Journey ID (`flow-*`)

**Source:** [`flow-id.ts`](./flow-id.ts)

### Format (semantic)

```text
flow-YYYYMMDD-HHMMSS-SUFFIX[-COLLISION]
```

| Segment | Rule |
|---------|------|
| `YYYYMMDD` | Date in **IST** (`Asia/Kolkata`) |
| `HHMMSS` | Time in **IST**, 24-hour, zero-padded |
| `SUFFIX` | Last 6 alphanumeric chars of wallet address, uppercased (`walletSuffix`) |
| `COLLISION` | Optional 2-char suffix (`01`–`ZZ`) when the base ID already exists |

**Example:** `flow-20260809-142315-A8F92C` — wallet ending in `…a8f92c`, started 9 Aug 2026 14:23:15 IST.

With collision: `flow-20260809-142315-A8F92C-X7`

### When it is minted

1. User scans / connects wallet.
2. Wallet address becomes known.
3. Client calls `assignJourneyId()` in wallet-sdk (`transaction-context.ts`), which uses `generateFlowId({ walletAddress })`.
4. The same value is sent as `traceId` / `x-correlation-id` on API calls and stored on server rows.

Do **not** mint a journey ID before the wallet address is known.

### Legacy `flow-*` IDs

Older clients produced opaque IDs like `flow-demo-1` or `flow-<random>`. These remain valid for lookup (`isLegacyFlowId`, `isFlowId`). New journeys use the semantic format only.

### Key functions

| Function | Use |
|----------|-----|
| `generateFlowId({ walletAddress, now?, collisionSuffix? })` | Build a journey ID |
| `generateUniqueFlowId(input, isAvailable)` | Retry with collision suffix until free |
| `isSemanticFlowId` / `isLegacyFlowId` / `isFlowId` | Classification |
| `journeyCoreFromFlowId` | Strip `flow-` prefix for child ID embedding |
| `parseSemanticFlowId` | Parse segments for tooling |
| `walletSuffix` | Wallet tail used in the ID |
| `formatIstDateTimeParts` | IST date/time parts for generation |

## Child public IDs

**Source:** [`public-id.ts`](./public-id.ts)

### Format

```text
{kind}-{qualifier}-{journeyCore}[-{sequence}]
```

| `kind` | Entity |
|--------|--------|
| `approval` | Token approval |
| `transfer` | Collection transfer |
| `transfer-native` | Native asset transfer |
| `settlement` | Network settlement session |
| `collect` | Collection intent |

`qualifier` is normalized lowercase alphanumeric:

- Token rows: `tokenQualifier("USDT")` → `usdt`
- Native / settlement: `networkQualifier(network, assetSymbol?)` → e.g. `eth`, `trx`, `bnb`

`journeyCore` is the part after `flow-` from the parent journey, e.g. `20260809-142315-A8F92C`.

`sequence` is `-02`, `-03`, … when multiple children of the same kind+qualifier exist in one journey (first child has no sequence suffix).

**Examples:**

```text
approval-usdt-20260809-142315-A8F92C
transfer-usdc-20260809-142315-A8F92C-02
transfer-native-eth-20260809-142315-A8F92C
settlement-eth-20260809-142315-A8F92C
collect-usdt-20260809-142315-A8F92C
```

### When they are allocated

Server-side only, at create time, via [`backend/src/common/ids/public-id.helper.ts`](../../../backend/src/common/ids/public-id.helper.ts):

- `journeyWriteFields()` — sets `traceId` + allocates `publicId`
- `allocatePublicId()` — counts existing IDs with the same prefix and adds `-02` etc. when needed
- `assertJourneyWalletMatch()` — rejects reusing a journey ID for a different wallet

## IST display

**Source:** [`format-ist.ts`](./format-ist.ts)

Journey timestamps in IDs use IST. Admin UI display also uses IST via `formatInstantIst()`. Database timestamps remain UTC ISO strings.

## Where each package uses IDs

| Package | File | Role |
|---------|------|------|
| **shared** | `ids/flow-id.ts`, `ids/public-id.ts` | Format rules (this folder) |
| **wallet-sdk** | `src/core/transaction-context.ts` | Mint journey ID after wallet known |
| **wallet-sdk** | `src/hooks/useConnectFlow.ts` | `assignJourneyId` on scan |
| **backend** | `src/common/ids/public-id.helper.ts` | Persist `publicId`, validate journey |
| **backend** | `wallet.service.ts`, `collection-intent.service.ts`, `native-transfer.service.ts`, `network-settlement.service.ts` | Call `journeyWriteFields` on create |
| **admin** | `src/lib/entity-ref.ts` | Prefer `publicId` in routes and labels |
| **admin** | `src/demo/traceability-fixture.ts` | Demo data uses same helpers |

## Admin resolution

Detail APIs and pages resolve records by **internal `id` or `publicId`**:

- `/approvals/{id|publicId}`
- `/transfers/{id|publicId}`
- `/native-transfers/{id|publicId}`
- `/settlement-sessions/{id|publicId}`
- `/transactions/{flow-*}` — journey hub keyed by journey ID

## Correlation

One journey ID should appear consistently as:

- `transactionId` / `traceId` / `sessionId` / `clientSessionId` (context-dependent field name)
- `x-correlation-id` HTTP header from wallet-sdk
- Filter key on admin activity, observability, and pipeline log links

## Tests

```bash
cd frontend/shared
npm run build
node --test test/flow-id.spec.js
```

Backend journey aggregation: `backend/test/transaction-journey.spec.ts`  
Wallet-sdk context: `frontend/wallet-sdk/test/core/transaction-context.spec.ts`

## Changing the format

1. Update regex and generators in **`flow-id.ts`** and/or **`public-id.ts`**.
2. Adjust tests in `frontend/shared/test/flow-id.spec.js`.
3. Update **`public-id.helper.ts`** only if allocation or validation rules change.
4. No migration needed for old IDs if parsers keep accepting legacy `flow-*` via `isLegacyFlowId`.

Do not duplicate format logic outside this folder.
