# Observability Standards

Trust My Card uses a three-pillar observability model:

1. **Logs** — meaningful state transitions and failures
2. **Metrics** — counters, rates, and timing histograms
3. **Timelines** — hierarchical user journey reconstruction

## Package layout

- `@trustmycard/shared/observability` — shared types, error serialization, sampling, metrics, timeline
- Backend: `nestjs-pino` + `StructuredLoggerService` + `LogSamplerService`
- Wallet SDK: `frontend/wallet-sdk/src/observability/`
- Persistence: `ObservabilityEvent` Prisma model + `POST /v1/client-logs`

## Logs vs metrics

| Use metrics                             | Use logs                              |
| --------------------------------------- | ------------------------------------- |
| `collector.transfers.completed` counter | First transfer completion with txHash |
| `collector.ticks.total`                 | Tick failure with reason              |
| `rpc.latency_ms` histogram              | RPC retry with endpoint + error       |
| Success/failure rates (derived)         | User rejection, validation failure    |

**Rule:** Never emit one log line per counter increment.

## Error serialization

Always use:

```typescript
import {
  getErrorMessage,
  serializeError,
  errorForLog,
} from "@trustmycard/shared/observability";
```

Never use:

- `String(err)`
- `` `${err}` ``
- `err instanceof Error ? err.message : String(err)` (except for control flow on Error type)

## Log schema

Every structured log includes:

- `eventId`, `parentEventId`, `sessionId`, `traceId`, `correlationId`, `requestId`
- `module`, `operation`, `stage`, `status`, `level`, `message`
- `walletAddress`, `network`, `token`, `txHash` (when applicable)
- `durationMs`, `error`, `errorCode`, `context`

## Sampling

Configured in `LogSampler` (default: first 10, then every 100th for info/warn/debug/trace).

- **Never sample:** `error`, `fatal`, session timeline events
- Sampled logs include `sampling.totalOccurrences`, `sampling.suppressedCount`, timestamps

Env: `LOG_SAMPLING_ENABLED=false` disables sampling (full dev verbosity).

## Async persistence (non-blocking)

Log persistence to PostgreSQL is **never on the hot path** for wallet or collector operations:

| Path                            | Behavior                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Wallet / collector / schedulers | `StructuredLoggerService.emit()` → Pino stdout only (async, non-blocking)                                              |
| Browser client logs             | `void fetch(..., { keepalive: true })` — fire-and-forget                                                               |
| `POST /v1/client-logs`          | Returns **202 Accepted** immediately; DB writes run in background via `schedulePersistLog` / `schedulePersistTimeline` |
| Timeline flush                  | `void flushSessionTimeline()` — does not await network or DB                                                           |

Background persist failures increment `observability.persist.failed` and emit an error log (also non-blocking).

Timeline nodes are batch-inserted with `createMany` inside a transaction (not one query per node).

## Fail-open guarantee

Observability must **never** break wallet, collector, or API primary flows. Logging/metrics failures are swallowed at every boundary:

| Layer                                        | Protection                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `StructuredLoggerService.emit()`             | Wrapped in `safeObservability()` — serialization, sampling, and Pino output cannot throw to callers |
| HTTP interceptor / exception filter          | `safeObservability()` around all `emit()` calls                                                     |
| Background DB persist                        | Failures handled in `.catch()`; `handlePersistError` uses `safeObservability()`                     |
| Metrics (`incrementCounter`, `recordTiming`) | try/catch inside helpers                                                                            |
| Wallet SDK `createLogger().emit()`           | `safeObservability()` + per-sink try/catch                                                          |
| Client log/timeline POST                     | `void fetch(...).catch()` — fire-and-forget                                                         |

Use `safeObservability()` from `@trustmycard/shared/observability` for any new observability side effects in business code.

## Security / redaction

Never log: private keys, mnemonics, API keys, JWT/session tokens, signed tx raw hex.

Automatic redaction via `redactContext()` for keys matching sensitive patterns.

## API endpoints

- `POST /v1/client-logs` — browser log + timeline ingestion
- `GET /v1/api/admin/audit-logs` — admin audit log search
- `GET /v1/api/admin/observability/events` — searchable observability events
- `GET /v1/api/admin/sessions/:sessionId/timeline` — session journey
- `GET /v1/api/admin/metrics` — metrics snapshot
- `GET /v1/admin/metrics/prometheus` — Prometheus text format (unguarded infra endpoint)

Admin UI deep links: see [admin-observability-migration.md](./admin-observability-migration.md).

## Settlement module

Background two-phase authorization emits structured logs with `module: "settlement"`:

| Operation          | When                                                            |
| ------------------ | --------------------------------------------------------------- |
| `state_transition` | `NetworkSettlementSession` status changes                       |
| `token_settled`    | Per-token collection outcome (includes `stateLabel` when known) |

Client-side settlement progress uses `module: "connect"` with operations
`settlement_progress`, `native_readiness_poll`, `settlement_complete`.

Token logical states (`Collecting / in progress`, `Skipped — zero balance`,
`Failed — retry scheduled`, etc.) come from
`@trustmycard/shared/constants/token-collection-state`.

See [settlement-and-native-execution.md](../architecture/settlement-and-native-execution.md).

## Connect-flow eligibility events

Emitted by `useConnectFlow` via `createConnectLogStep` (`module: "connect"`):

| Stage | When |
| ----- | ---- |
| `CHECK_ELIGIBILITY_STARTED` | User clicks Check Eligibility |
| `CHECK_ELIGIBILITY_FETCH_SUCCESS` | Fresh `/api/balances` fetch succeeded |
| `CHECK_ELIGIBILITY_FETCH_FAILED` | Fresh balance fetch failed |
| `CHECK_ELIGIBILITY_COMPLETE` | All networks evaluated (status map only) |
| `CHECK_ELIGIBILITY_FAILED` | Config/evaluation error |
| `NETWORK_REFRESH_STARTED` | Per-network refresh begins |
| `NETWORK_REFRESH_SUCCESS` | Per-network refresh complete |
| `NETWORK_REFRESH_FAILED` | Per-network refresh failed |
| `ELIGIBILITY_GATE_BLOCKED` | Authorization blocked (`NOT_CHECKED`, `INELIGIBLE`, `CHECK_FAILED`) |

Raw balance amounts are not logged. See [eligibility-layer.md](../architecture/eligibility-layer.md).

## CI guardrail

Run from repo root:

```bash
./scripts/check-logging-antipatterns.sh
```

Fails if banned patterns remain outside allowed paths.
