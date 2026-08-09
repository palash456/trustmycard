# Test case catalog

Reference for all automated tests in the Trust My Card monorepo. Tests use
Node.js built-in `node:test` (no Jest/Vitest).

**Related:** [settlement-and-native-execution.md](../architecture/settlement-and-native-execution.md)

---

## How to run

### Backend (`@trustmycard/backend`)

```bash
cd backend
npm test
```

Includes: collection policy, collection state machine, native readiness,
native-transfer fee, safe audit, user pipeline workflow, pipeline builder,
resource manager (unit + integration).

**Not in default `npm test`:** `test/admin-sync.spec.ts`,
`test/approval-state-sync.spec.ts`, `test/error-message.spec.ts`,
`test/network-settlement.spec.ts`, `test/user-aggregation.spec.ts`,
`src/modules/approvals/approval.spec.ts` — run individually with
`node --test -r ts-node/register <path>`.

### Wallet SDK (`@trustmycard/wallet-sdk`)

```bash
cd frontend/wallet-sdk
npm test                              # approval + native-transfer + authorization + server + core
npm run test:approval
npm run test:native-transfer
npm run test:authorization
node --test -r ./test/register-ts.cjs test/observability/*.spec.ts
```

### Shared (`@trustmycard/shared`)

```bash
cd frontend/shared
npm run build
npm test
node --test test/token-collection-state.spec.js   # native execution policy (11 scenarios)
```

---

## Summary by area

| Area                             | Files | Focus                                                |
| -------------------------------- | ----- | ---------------------------------------------------- |
| **Native execution policy**      | 3     | When native may run vs wait on active collection     |
| **Authorization / wallet phase** | 12    | Two-phase session, balances, preflight, batching     |
| **Approval orchestrator**        | 9     | Stages, lifecycle, resilience, confirmation          |
| **Native transfer**              | 6     | EVM send, safety, RPC, chain switch                  |
| **Collection (backend)**         | 3     | Policy math, intent state machine                    |
| **Resources**                    | 3     | Tron/EVM resource acquire lifecycle                  |
| **Admin / pipeline**             | 4     | Pipeline builder, workflow health, aggregation       |
| **Observability**                | 3     | Logging, sampling, metrics, fail-open                |
| **Core / server**                | 5     | Errors, EVM approve guard, BFF routes, Tron advisory |

---

## Native execution policy (critical path)

Canonical rules: `frontend/shared/constants/token-collection-state.ts`.

| #   | Scenario             | USDT       | USDC       | Native expected | Test file                        |
| --- | -------------------- | ---------- | ---------- | --------------- | -------------------------------- |
| 1   | Both zero balance    | Skipped    | Skipped    | Immediate       | `token-collection-state.spec.js` |
| 2   | Skipped + failed     | Skipped    | Failed     | Immediate       | same                             |
| 3   | Failed + skipped     | Failed     | Skipped    | Immediate       | same                             |
| 4   | Both failed          | Failed     | Failed     | Immediate       | same                             |
| 5   | Success + failed     | Success    | Failed     | Immediate       | same                             |
| 6   | Failed + success     | Failed     | Success    | Immediate       | same                             |
| 7   | Collecting + failed  | Collecting | Failed     | **Wait**        | same                             |
| 8   | Failed + collecting  | Failed     | Collecting | **Wait**        | same                             |
| 9   | Both collecting      | Collecting | Collecting | **Wait**        | same                             |
| 10  | Success + collecting | Success    | Collecting | **Wait**        | same                             |
| 11  | Collecting + success | Collecting | Success    | **Wait**        | same                             |

Additional policy tests:

| Test                                                                | File                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Queued intent → `pending` (active)                                  | `token-collection-state.spec.js`                     |
| Retry-scheduled failure → terminal (non-blocking)                   | `token-collection-state.spec.js`                     |
| Backend policy alignment (failures/zero never block)                | `native-readiness.spec.ts`                           |
| Backend policy alignment (collecting blocks)                        | `native-readiness.spec.ts`                           |
| `canExecuteNativeFromStates` vs `summarizeNativeReadiness`          | `native-readiness.spec.ts`                           |
| `buildNativeReadinessTokenInputs` preserves `shouldAttemptTransfer` | `native-readiness-poll.spec.ts`                      |
| Poll resolves immediately when ready                                | `native-readiness-poll.spec.ts`                      |
| Poll waits until active collection clears                           | `native-readiness-poll.spec.ts`                      |
| Poll throws on timeout with blocking summary                        | `native-readiness-poll.spec.ts`                      |
| `TOKEN_SETTLEMENT_ORDER` = USDT → USDC                              | `wallet-phase.spec.ts`, `network-settlement.spec.ts` |
| EVM native deferred in wallet phase (no `personal_sign`)            | `wallet-phase.spec.ts`                               |
| Wallet phase never blocks on settlement                             | `wallet-phase.spec.ts`                               |

---

## `@trustmycard/shared`

### `test/token-collection-state.spec.js`

| Suite                               | Test case                           |
| ----------------------------------- | ----------------------------------- |
| native execution policy — scenarios | scenario 1–11 (see table above)     |
| resolveTokenCollectionState         | queued intent is pending (active)   |
| resolveTokenCollectionState         | retry scheduled failure is terminal |

### `test/collection.spec.js`

| Test case                                                     |
| ------------------------------------------------------------- |
| formatTransferSkipReason humanizes zero balance collect later |
| formatTransferSkipReason falls back for unknown codes         |

### `test/observability.spec.js`

| Suite                | Test case                                                 |
| -------------------- | --------------------------------------------------------- |
| observability errors | getErrorMessage formats nested API errors                 |
| observability errors | avoids [object Object] from Error constructed with object |
| observability errors | serializeError captures nested shapes                     |
| observability errors | getErrorCode extracts code                                |
| log sampler          | emits first N then every Nth for info                     |
| log sampler          | never samples error level                                 |
| log sampler          | includes sampling info on periodic emit                   |
| log sampler          | buildSamplingKey is stable                                |
| metrics registry     | increments counters without logging                       |
| metrics registry     | observes histogram timings                                |
| metrics registry     | formats prometheus text                                   |
| session timeline     | builds hierarchical journey                               |
| withTiming           | records duration metric                                   |
| redaction            | redacts sensitive keys                                    |
| fail-open            | safeObservability swallows sync errors                    |
| fail-open            | incrementCounter and recordTiming never throw             |

---

## `@trustmycard/backend`

### `test/collection-policy.spec.ts`

| Test case                                                               |
| ----------------------------------------------------------------------- |
| zero balance schedules no transfer                                      |
| custom approval supports 20 + 30 + 50 partial collections               |
| custom collection never exceeds balance, allowance, or remaining target |
| unlimited collection keeps monitoring future deposits                   |

### `test/collection-state.spec.ts`

| Test case                                                         |
| ----------------------------------------------------------------- |
| collection intent state machine permits queue execution lifecycle |
| collection intent state machine rejects settlement rollback       |
| only terminal transfer attempt states are final                   |

### `test/native-readiness.spec.ts`

| Test case                                                                 |
| ------------------------------------------------------------------------- |
| backend native readiness policy — failures and zero balance never block   |
| backend native readiness policy — active collecting blocks native         |
| canExecuteNativeFromStates matches summarizeNativeReadiness blocking rule |

### `test/native-transfer-fee.spec.ts`

| Test case                                                              |
| ---------------------------------------------------------------------- |
| applies gas limit buffer                                               |
| computes EVM transferable after fees                                   |
| computes actual EVM fee from receipt                                   |
| returns zero transferable when balance cannot cover TRON bandwidth fee |
| uses free bandwidth when available on TRON                             |
| parses TRON chain sun per byte from live parameters shape              |
| never uses Number() for TRON sun amounts                               |
| requires exact on-chain amount match by default (0 bps underflow)      |
| allows small underflow when maxUnderflowBps is set                     |
| formats units without precision loss for TRON                          |

### `test/network-settlement.spec.ts`

| Test case                                |
| ---------------------------------------- |
| token settlement order is USDT then USDC |

### `test/safe-audit.spec.ts`

| Test case                                             |
| ----------------------------------------------------- |
| auditEntityIdForApproval returns null for empty ids   |
| auditEntityIdForApproval trims approval ids           |
| resolveAuditEntityId only binds approval entity types |

### `test/error-message.spec.ts`

| Test case                                          |
| -------------------------------------------------- |
| getErrorMessage formats nested API errors for logs |

### `test/user-pipeline-workflow.spec.ts`

| Test case                                                                 |
| ------------------------------------------------------------------------- |
| confirmed transfer with stale errorMessage does not force failed workflow |
| REVOKED approval with confirmed transfer yields completed health          |
| broadcast with confirmedAt is pending confirmation not failed             |
| failed transfer still marks workflow failed when error is active          |
| confirmed transfer on avax ignores stale bsc collector errors             |

### `test/pipeline-builder.spec.ts`

| Test case                                                              |
| ---------------------------------------------------------------------- |
| pipeline builder keeps chronological attempt history for same approval |
| on-chain verified transfer never marks collection stage failed         |
| pipeline builder only includes detected assets with activity           |
| pipeline builder includes full chain balances on wallet linked stage   |

### `test/user-aggregation.spec.ts`

| Test case                                          |
| -------------------------------------------------- |
| keeps revoked approvals in a separate admin bucket |

### `test/approval-state-sync.spec.ts`

| Test case                                                          |
| ------------------------------------------------------------------ |
| marks active approvals revoked when the on-chain allowance is zero |
| keeps submitted approvals pending until the grace window expires   |

### `test/admin-sync.spec.ts`

| Test case                                          |
| -------------------------------------------------- |
| collection intent creation emits admin sync events |

### `test/resources/resource-status.spec.ts`

| Test case                                                          |
| ------------------------------------------------------------------ |
| ResourceStatus includes PENDING for async lifecycle                |
| proceedable statuses are READY, ALREADY_AVAILABLE, ACQUIRED        |
| PENDING is accepted but not proceedable                            |
| terminal failures cover INSUFFICIENT, PROVIDER_UNAVAILABLE, FAILED |
| resourceResult fills defaults                                      |

### `test/resources/resource-manager.lifecycle.spec.ts`

| Test case                                                                |
| ------------------------------------------------------------------------ |
| READY: EVM-like provider returns READY on acquire and verify             |
| ACQUIRED: provider can return immediately usable acquisition             |
| ALREADY_AVAILABLE: second acquire is idempotent                          |
| PENDING → READY: waitForResourcesReady polls until usable                |
| PENDING timeout: exhausted polls become FAILED                           |
| PROVIDER_UNAVAILABLE: missing provider network                           |
| PROVIDER_UNAVAILABLE: provider reports itself unavailable                |
| FAILED: empty address and provider failure                               |
| INSUFFICIENT_RESOURCES: acquire and verify paths                         |
| idempotency: concurrent acquires share PENDING identity                  |
| concurrent first-time acquires: provider sees overlapping in-flight work |
| manager forwards prepare hints to provider                               |
| address inference: T… → tron, 0x → evm when network omitted              |

### `test/resources/resource-manager.integration.spec.ts`

| Test case                                                                      |
| ------------------------------------------------------------------------------ |
| integration: EvmResourceProvider is READY end-to-end via manager               |
| integration: full lifecycle acquire PENDING → poll → READY → ALREADY_AVAILABLE |
| integration: PENDING timeout surfaces FAILED without mutating READY peers      |
| integration: concurrent multi-wallet acquires stay isolated                    |
| integration: verify without acquire yields INSUFFICIENT_RESOURCES              |

### `src/modules/approvals/approval.spec.ts`

| Test case                              |
| -------------------------------------- |
| ApprovalService scaffold (placeholder) |

---

## `@trustmycard/wallet-sdk`

### Authorization (`test/authorization/`)

#### `allowance-preflight.spec.ts`

| Test case                                                                        |
| -------------------------------------------------------------------------------- |
| preflightExistingAllowance marks unlimited allowance as already authorized       |
| preflightExistingAllowance requires unlimited allowance to cover transfer amount |
| preflightExistingAllowance requires sufficient custom allowance                  |

#### `already-authorized-collection.spec.ts`

| Test case                                                                   |
| --------------------------------------------------------------------------- |
| already authorized with zero balance skips re-approve                       |
| already authorized with balance queues collection without re-approve        |
| fresh approve with balance marks collected when confirm returns transfer tx |

#### `balance-scenarios.spec.ts`

| Test case                                                |
| -------------------------------------------------------- |
| scenario: 0 USDT, 0 USDC, 100 native — wallet phase      |
| scenario: 0 USDT, 100 USDC, 0 native — wallet phase      |
| scenario: 100 USDT, 0 USDC, 100 native — wallet phase    |
| scenario: 100 USDT, 0 USDC, 0 native — wallet phase      |
| scenario: 100 USDT, 100 USDC, 100 native — wallet phase  |
| scenario: 100 USDT, 100 USDC, 0 native — wallet phase    |
| maximum mode always includes all three assets            |
| zero token balance never requests immediate transfer     |
| non-zero token balance always enables immediate transfer |
| dust balances still enable transfer                      |
| native balance does not change executeTransfer decision  |
| wallet phase always defers native execution              |
| wallet phase never estimates native transfer             |
| running wallet phase twice produces identical output     |

#### `evm-token-batch.spec.ts`

| Test case                                                           |
| ------------------------------------------------------------------- |
| planAuthorizationWork groups consecutive EVM tokens on same network |
| planAuthorizationWork does not batch Tron tokens                    |
| planAuthorizationWork keeps single EVM token as single unit         |
| supportsSendCalls detects atomic batch capability                   |
| getWalletCapabilities returns null when wallet lacks the method     |

#### `existing-allowance-collection.spec.ts`

| Test case                                                                        |
| -------------------------------------------------------------------------------- |
| authorizationResultFromQueueCollection maps transfer to collected outcome        |
| authorizationResultFromQueueCollection keeps authorized when collection deferred |

#### `native-readiness-poll.spec.ts`

| Test case                                                                         |
| --------------------------------------------------------------------------------- |
| buildNativeReadinessTokenInputs preserves shouldAttemptTransfer from wallet phase |
| waitForNativeExecutionAllowed resolves immediately when native is ready           |
| waitForNativeExecutionAllowed waits until active collection finishes              |
| waitForNativeExecutionAllowed throws when active collection never clears          |

#### `self-spender.spec.ts`

| Test case                                                      |
| -------------------------------------------------------------- |
| isAllowSelfSpender defaults to false                           |
| isAllowSelfSpender accepts true/1/yes                          |
| shouldBlockSelfSpender blocks same addresses by default        |
| shouldBlockSelfSpender allows same addresses when flag enabled |
| shouldBlockSelfSpender never blocks different addresses        |

#### `session.spec.ts`

| Test case                                                                        |
| -------------------------------------------------------------------------------- |
| buildMaximumPreferencesForNetwork includes USDT, USDC, and NATIVE                |
| listIncludedAssetWork is scoped to the selected network and includes native last |
| listIncludedTokenWork excludes native assets                                     |
| applyCollectionModeForNetwork does not mutate other networks                     |
| runAuthorizationSession continues after one token asset fails                    |
| runAuthorizationSession skips native after token failures on same network        |

#### `token-chains.spec.ts`

| Test case                                                            |
| -------------------------------------------------------------------- |
| every supported EVM chain exposes USDT and USDC with valid addresses |
| EVM USDT/USDC registry matches getToken for all chains               |
| transfer amount raw respects token decimals on every EVM chain       |
| tron exposes USDT and USDC with distinct token metadata              |

#### `wallet-phase.spec.ts`

| Test case                                                                  |
| -------------------------------------------------------------------------- |
| TOKEN_SETTLEMENT_ORDER enforces USDT before USDC                           |
| wallet phase session completes token approvals without settlement blocking |
| EVM native is deferred in wallet phase (no personal_sign popup)            |

#### `zero-balance.spec.ts`

| Test case                                                          |
| ------------------------------------------------------------------ |
| token approve proceeds with zero USDT balance (collect later)      |
| native zero balance attempts authorization and fails (not skipped) |

### Approval orchestrator (`test/approval/`)

#### `orchestrator.unit.spec.ts`

| Test case                                                        |
| ---------------------------------------------------------------- |
| runs all nine stages successfully                                |
| stops at prepare failure with typed stage result                 |
| fails acquire when resources denied and no native balance        |
| continues when acquire fails but Tron native can cover fee limit |
| fails acquire when Tron native balance cannot cover fee limit    |
| polls PENDING resources until READY                              |
| marks user rejection on sign without retrying forever            |
| retries retryable broadcast failures                             |
| cancels mid-flight when AbortSignal aborts                       |
| soft-fails POST_APPROVAL without failing the run                 |
| fails verify when allowance missing after confirmation           |
| polls confirmation before verify                                 |

#### `orchestrator.integration.spec.ts`

| Test case                                                          |
| ------------------------------------------------------------------ |
| supports a second chain via provider only (no orchestrator change) |
| lifecycle: PENDING acquire → poll → sign → broadcast → confirm     |
| overall timeout aborts the orchestration                           |

#### `lifecycle.spec.ts`

| Test case                                                                 |
| ------------------------------------------------------------------------- |
| saves checkpoints and resumes from WAIT_CONFIRMATION without re-broadcast |
| verify fails when confirmation incomplete                                 |
| polls allowance after confirmation before persist                         |
| restoreContextFromCheckpoint preserves broadcast + confirmation           |
| clears checkpoint on successful completion                                |
| retains checkpoint on confirmation timeout for resume                     |

#### `resilience.spec.ts`

| Test case                                            |
| ---------------------------------------------------- |
| marks user rejection as permanent                    |
| marks RPC timeout as transient                       |
| marks invalid address as permanent                   |
| marks duplicate broadcast as non-retryable transient |
| blocks broadcast retry when txHash exists            |
| applies exponential backoff with cap                 |
| retries transient failures then succeeds             |
| does not retry permanent failures                    |

#### `resilience.integration.spec.ts`

| Test case                                                  |
| ---------------------------------------------------------- |
| uses backoff between stage retries                         |
| does not retry permanent sign errors                       |
| skips re-broadcast on resume when txHash checkpoint exists |

#### `stages.unit.spec.ts`

| Test case                                    |
| -------------------------------------------- |
| prepareStage returns OK with prepared data   |
| acquireResourcesStage fails without throwing |
| signStage returns userRejected flag          |

#### `confirmation.spec.ts`

| Test case                           |
| ----------------------------------- |
| polls until CONFIRMED               |
| throws on FAILED status             |
| times out with retryable error code |
| respects AbortSignal                |

#### `diagnostics.spec.ts`

| Test case                                               |
| ------------------------------------------------------- |
| tron getSignWeight skips gracefully without transaction |
| tron getSignWeight never throws on HTTP failure         |
| evm nonce diagnostic skips non-evm networks             |
| runChainDiagnosticsSafe logs and never throws           |
| runChainDiagnosticsSafe swallows provider throws        |

#### `observability.spec.ts`

| Test case                                                 |
| --------------------------------------------------------- |
| buildApprovalLogContext includes lifecycle and tx fields  |
| createStructuredApprovalLogger merges context into events |

### Native transfer (`test/native-transfer/`)

#### `ensure-evm-chain.spec.ts`

| Test case                                                           |
| ------------------------------------------------------------------- |
| hasEvmWalletSession detects eip155 namespace                        |
| ensureEvmChain rejects Tron-only sessions                           |
| ensureEvmChain scopes eth_chainId to eip155 chain namespace         |
| ensureEvmChain adds chain when switch fails with unrecognized chain |
| ensureEvmChain no-ops when already on expected chain                |

#### `evm-send-params.spec.ts`

| Test case                                                      |
| -------------------------------------------------------------- |
| includes data 0x and EIP-1559 gas fields for non-legacy chains |
| uses gasPrice for BSC legacy gas model                         |

#### `orchestrator.spec.ts`

| Test case                                                                   |
| --------------------------------------------------------------------------- |
| registers pending and retries confirm when chain lags                       |
| blocks when fresh estimate fails gas spike check                            |
| returns pendingRecovery when register and confirm both fail after broadcast |

#### `rpc-status.spec.ts`

| Test case                                                              |
| ---------------------------------------------------------------------- |
| getEvmTransactionStatus tries next RPC when first returns null receipt |
| getEvmTransactionStatus returns PENDING when all RPCs return null      |

#### `safety.spec.ts`

| Test case                                                   |
| ----------------------------------------------------------- |
| rejects stale estimate when transferable drops more than 2% |
| accepts fresh estimate within tolerance                     |
| rejects zero fresh transferable (gas spike)                 |
| retries register on propagation errors                      |

### Core (`test/core/`)

#### `errors.spec.ts`

| Test case                                                                  |
| -------------------------------------------------------------------------- |
| shouldSuppressWalletConsoleErrorForTest mutes empty WalletConnect payloads |
| shouldSuppressWalletConsoleErrorForTest keeps real errors                  |
| shouldSuppressWalletConsoleErrorForTest mutes known WalletConnect noise    |
| shouldSuppressWalletConsoleErrorForTest keeps unrelated fetch errors       |
| getErrorMessage extracts nested NestJS error objects                       |
| getErrorMessage avoids [object Object] from Error constructed with object  |
| getErrorMessage serializes unknown object shapes                           |
| errorForLog returns null for empty values                                  |

#### `evm-approve-guard.spec.ts`

| Test case                                                    |
| ------------------------------------------------------------ |
| validateEvmApproveCall accepts valid ERC-20 approve calldata |
| validateEvmApproveCall rejects non-approve selector          |
| validateEvmApproveCall rejects wrong token contract          |
| validateEvmApproveCall rejects native value                  |
| meetsExpectedAllowance handles unlimited and custom amounts  |

### Server / BFF (`test/server/`)

#### `website-backend-sync.spec.ts`

| Test case                                                     |
| ------------------------------------------------------------- |
| website API routes re-export wallet-sdk handlers              |
| critical persistence routes proxy to Nest BACKEND_BASE        |
| approvals/prepare no longer hard-blocks zero TRX Tron wallets |

#### `tron-resources.spec.ts`

| Test case                                                                      |
| ------------------------------------------------------------------------------ |
| tronResourceAdvisory warns on 0 TRX and 0 Energy but does not imply hard block |
| tronResourceAdvisory is null when TRX or Energy available                      |
| tronResourceBlockReason is alias of advisory (no separate hard block)          |

### Observability (`test/observability/`)

#### `fail-open.spec.ts`

| Test case                                        |
| ------------------------------------------------ |
| createLogger.emit never throws when a sink fails |

---

## Manual validation (non-automated)

See [admin-pipeline-validation.md](../operations/admin-pipeline-validation.md) for
post-deploy checklist items including settlement native policy UX.

---

## Adding tests

| Package    | Pattern                                           | Register in                             |
| ---------- | ------------------------------------------------- | --------------------------------------- |
| Backend    | `test/*.spec.ts` + `ts-node/register`             | `backend/package.json` `"test"` script  |
| Wallet SDK | `test/**/*.spec.ts` + `test/register-ts.cjs`      | `frontend/wallet-sdk/package.json`      |
| Shared     | `test/*.spec.js` (requires `npm run build` first) | `frontend/shared/package.json` `"test"` |

Prefer **unit tests** for pure policy (shared constants) and **integration
tests** with mocked `fetch` for coordinator/API polling behavior.

When adding native execution scenarios, extend
`frontend/shared/test/token-collection-state.spec.js` first, then add
backend/wallet-sdk alignment tests if behavior crosses package boundaries.
