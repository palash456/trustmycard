# Platform constants audit

Audit date: 2026-07-31  
Source of truth: [`config/platform.env`](../../config/platform.env) → `PlatformConfigService` → `GET /v1/api/settings/public` → frontend/admin.

## Spender addresses — why they were missing

`SPENDER_EVM` and `SPENDER_TRON` were intentionally **derived from private keys** at startup (`ADMIN_EVM_PRIVATE_KEY` / `ADMIN_TRON_PRIVATE_KEY`) so operators could not accidentally configure a spender address that did not match the signing key.

They are now **first-class keys** in `platform.env`:

| Key            | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `SPENDER_EVM`  | EVM allowance spender + native transfer recipient |
| `SPENDER_TRON` | TRON allowance spender + native TRX recipient     |

Resolution order: `SPENDER_*` → legacy `NEXT_PUBLIC_SPENDER_*` → derived from private key. If explicit and derived values both exist, startup validation requires they match.

Current values (derived from keys in `platform.env`):

- `SPENDER_EVM=0x8bF415A644516Ef9e6eD8A0f8fEF8bC860009a4F`
- `SPENDER_TRON=TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF`

---

## Constants moved to `platform.env`

### Wallets & approval

| Env key                               | Default      | Previously hardcoded in                     |
| ------------------------------------- | ------------ | ------------------------------------------- |
| `SPENDER_EVM` / `SPENDER_TRON`        | derived      | env vars, ConnectFlow props, wallet.service |
| `APPROVE_AMOUNT_USDT_DEFAULT`         | `0`          | settings-keys, approve-config               |
| `TERMS_VERSION`                       | `2026-07-28` | approve-config, wallet.service              |
| `ALLOW_SELF_SPENDER`                  | `false`      | settings-keys                               |
| `TRON_APPROVE_FEE_LIMIT_SUN`          | `150000000`  | approve-config, tron routes                 |
| `TRON_TRANSFER_FEE_LIMIT_SUN`         | `300000000`  | wallet.service                              |
| `APPROVAL_VERIFY_INTERVAL_MS`         | `1500`       | wallet.service, verify stages               |
| `APPROVAL_VERIFY_MAX_ATTEMPTS`        | `3`          | wallet.service                              |
| `APPROVAL_POST_CONFIRM_DELAY_EVM_MS`  | `600`        | wallet.service, post-confirm                |
| `APPROVAL_POST_CONFIRM_DELAY_TRON_MS` | `1200`       | wallet.service, post-confirm                |

### Collector & collection queue

| Env key                                   | Default   | Previously hardcoded in         |
| ----------------------------------------- | --------- | ------------------------------- |
| `COLLECTOR_ENABLED`                       | `true`    | schedulers, settings            |
| `COLLECTOR_INTERVAL_MS`                   | `120000`  | approval-collection.scheduler   |
| `COLLECTOR_BATCH_SIZE`                    | `20`      | scheduler                       |
| `COLLECTOR_LEASE_MS`                      | `900000`  | scheduler                       |
| `COLLECTOR_RPC_TIMEOUT_MS`                | `15000`   | wallet.service, native-transfer |
| `COLLECTION_SUBMITTED_GRACE_MS`           | `1800000` | collection recovery             |
| `COLLECTION_FAILURE_BACKOFF_MAX`          | `8`       | collection-intent               |
| `COLLECTION_DEFAULT_MODE`                 | `maximum` | settings, useConnectFlow        |
| `COLLECTION_DISPATCH_MODE`                | `poll`    | jobs module                     |
| `COLLECTION_QUEUE_CONCURRENCY`            | `4`       | collection-queue                |
| `COLLECTION_CONFIRMATION_CONCURRENCY`     | `16`      | workers                         |
| `COLLECTION_QUEUE_ATTEMPTS`               | `8`       | collection-queue                |
| `COLLECTION_QUEUE_BACKOFF_MS`             | `5000`    | collection-queue                |
| `COLLECTION_QUEUE_COMPLETE_RETENTION_SEC` | `86400`   | collection-queue.service        |
| `COLLECTION_QUEUE_COMPLETE_MAX_COUNT`     | `10000`   | collection-queue.service        |
| `COLLECTION_DLQ_LIST_LIMIT`               | `200`     | collection-queue.service        |
| `COLLECTION_RECOVERY_INTERVAL_MS`         | `30000`   | recovery scheduler              |
| `COLLECTION_RECOVERY_BATCH_SIZE`          | `100`     | recovery scheduler              |
| `OUTBOX_PUBLISH_INTERVAL_MS`              | `1000`    | outbox publisher                |
| `OUTBOX_CLAIM_BATCH_SIZE`                 | `100`     | outbox publisher                |
| `OUTBOX_CLAIM_LOCK_MS`                    | `60000`   | outbox.service                  |
| `COLLECTION_WORKERS_ENABLED`              | `false`   | workers                         |
| `MERCHANT_WEBHOOK_CONCURRENCY`            | `8`       | merchant-webhook.worker         |
| `MERCHANT_WEBHOOK_TIMEOUT_MS`             | `10000`   | merchant-webhook.worker         |

### Native transfer & reconcile

| Env key                                 | Default         | Previously hardcoded in                  |
| --------------------------------------- | --------------- | ---------------------------------------- |
| `NATIVE_RECONCILE_*`                    | see example     | native-transfer-reconciliation.scheduler |
| `NATIVE_PENDING_MAX_RECONCILE_ATTEMPTS` | `120`           | scheduler                                |
| `NATIVE_AMOUNT_MAX_UNDERFLOW_BPS`       | `1`             | native-transfer-fee (backend)            |
| `NATIVE_TRANSFER_LOCK_TTL_MS`           | `120000`        | safety.ts                                |
| `NATIVE_CONFIRM_RETRY_DELAYS_MS`        | `2000,5000,...` | safety.ts                                |
| `NATIVE_REGISTER_RETRY_DELAYS_MS`       | `1000,2000,...` | safety.ts                                |
| `NATIVE_ESTIMATE_MAX_UNDERFLOW_BPS`     | `200`           | safety.ts (was 9800/10000 = 2%)          |
| `NATIVE_TX_VISIBILITY_MAX_ATTEMPTS`     | `4`             | native-transfer.service                  |
| `NATIVE_TX_VISIBILITY_BASE_DELAY_MS`    | `750`           | native-transfer.service                  |

### Transfer / gas (backend)

| Env key                                      | Default      | Previously hardcoded in                        |
| -------------------------------------------- | ------------ | ---------------------------------------------- |
| `EVM_TX_CONFIRM_TIMEOUT_MS`                  | `60000`      | wallet.service                                 |
| `ALLOWANCE_POLL_DELAY_EVM_MS`                | `900`        | wallet.service                                 |
| `ALLOWANCE_POLL_DELAY_TRON_MS`               | `1500`       | wallet.service                                 |
| `TRANSFER_CONFIRMATION_RETRY_DELAY_MS`       | `2000`       | wallet.service, collection-confirmation.worker |
| `TRON_TX_CONFIRM_MAX_ATTEMPTS`               | `30`         | wallet.service                                 |
| `TRON_TX_CONFIRM_POLL_MS`                    | `2000`       | wallet.service                                 |
| `EVM_GAS_LIMIT_BUFFER_NUMERATOR/DENOMINATOR` | `120/100`    | native-transfer-fee, native-transfer.service   |
| `EVM_GAS_ESTIMATE_FALLBACK`                  | `21000`      | native-transfer.service                        |
| `EVM_MIN_PRIORITY_FEE_WEI`                   | `1000000000` | native-transfer.service                        |

### Client (browser / wallet-sdk via public API)

| Env key                                 | Default    | Wired via                                           |
| --------------------------------------- | ---------- | --------------------------------------------------- |
| `CLIENT_CONFIRMATION_POLL_MS`           | `2000`     | `setClientConfirmationDefaults()` in useConnectFlow |
| `CLIENT_CONFIRMATION_MAX_ATTEMPTS`      | `30`       | same                                                |
| `CLIENT_CONFIRMATION_CONFIRMATIONS`     | `1`        | same                                                |
| `CLIENT_RESOURCE_POLL_MIN/MAX_DELAY_MS` | `500/8000` | public API (resource-sponsor-client pending)        |
| Native client policy keys               | see above  | `setNativeClientPolicy()` in useConnectFlow         |

### TRON resources & chains

| Env key                     | Default                   | Previously hardcoded in             |
| --------------------------- | ------------------------- | ----------------------------------- |
| `RESOURCE_SPONSOR_ENABLED`  | `true`                    | settings                            |
| `TRON_ENERGY_*`             | see example               | tron.resource-provider              |
| `PLATFORM_ENABLED_NETWORKS` | `eth,bsc,...`             | wallet.service                      |
| `TRON_FULL_HOST`            | `https://api.trongrid.io` | multiple routes (partial migration) |
| `WALLET_SESSION_TTL_MS`     | `1800000`                 | wallet-session.service              |

### Eligibility minimum balances (website / wallet-sdk)

| Env key pattern | Default (Aug 2026) | Wired via |
| --- | --- | --- |
| `NEXT_PUBLIC_{NETWORK}_MIN_NATIVE_BALANCE` | `0` | `eligibility-config.ts` → ConnectFlow gate |
| `NEXT_PUBLIC_{NETWORK}_MIN_USDT_BALANCE` | `0` | same |
| `NEXT_PUBLIC_{NETWORK}_MIN_USDC_BALANCE` | `0` | same |

Networks: `ETH`, `BSC`, `POLYGON`, `AVAX`, `ARB`, `BASE`, `TRON`. Baked into the website at build time (`NEXT_PUBLIC_*`). Restart **website** after edits. See [eligibility-layer.md](../architecture/eligibility-layer.md).

---

## Intentionally NOT in `platform.env`

### Infrastructure secrets (stay in `backend/.env.local`, deployment env)

- `DATABASE_URL`, `REDIS_URL`, `PORT`
- `ADMIN_API_KEY`, `ADMIN_PANEL_PASSWORD`, `ADMIN_SESSION_SECRET`
- `BACKEND_API_URL`, Telegram tokens
- Private keys remain in `platform.env` (gitignored custody file), not in source code

### Compile-time / protocol constants

- USDT/USDC contract addresses, EVM chain IDs, CAIP chain identifiers
- TRON account activation sun (`1_000_000`), ABI selectors, ERC-20 decimals
- WalletConnect namespace metadata
- Admin UI pagination defaults, SSE display limits, log truncation caps
- `native-transfer-fee.ts` TRON chain-parameter fallbacks when RPC omits values
- Test-only fixtures

### Remaining policy duplicates (follow-up)

| Area                         | Location                                          | Notes                                                      |
| ---------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| TronGrid URL                 | ~10 wallet-sdk server routes                      | Use `getTronFullHost()` from platform-config-client        |
| Approval verify (client)     | `verify-approval.ts`, `evm-token-batch.ts`        | Still default 5×1500 ms; should read `platform.approval.*` |
| Post-confirm delays (client) | `post-confirm.ts`                                 | Should read `platform.approval.postConfirmDelay*`          |
| Stage retry tree             | `approval/resilience/retry.ts`                    | Per-stage backoff not yet in loader                        |
| Resource poll (client)       | `resource-sponsor-client.ts`, `wait-resources.ts` | Partially in `CLIENT_RESOURCE_POLL_*`                      |
| EVM RPC registry             | `wallet.service.ts` + shared native-chains        | Public RPC URLs — chain catalog                            |
| Admin transfer route         | `admin/transfer/route.ts`                         | Still reads `ADMIN_*_PRIVATE_KEY` — should proxy backend   |
| Withdraw limits              | —                                                 | **Not implemented** in codebase                            |

Loader fallbacks in `platform-config.loader.ts` are canonical defaults when a key is omitted from `platform.env`.

---

## Verification

- Backend reads platform policy only through `PlatformConfigService`.
- Website loads config server-side and passes `platform` to `ConnectFlow`.
- `useConnectFlow` installs native + confirmation client policies from `platform`.
- Startup log prints `spenderEvm` and `spenderTron`.
- Restart **backend + website** after editing `config/platform.env`.

## Status

**Backend collection/native/transfer/worker policies:** centralized.  
**Spender addresses:** explicit in `platform.env` with key validation.  
**Client policies:** native safety + tx confirmation wired; approval verify/post-confirm/TronGrid dedup remain as follow-ups.  
**No withdrawal limits** exist to migrate.
