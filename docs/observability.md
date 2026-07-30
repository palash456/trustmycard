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

| Use metrics | Use logs |
|-------------|----------|
| `collector.transfers.completed` counter | First transfer completion with txHash |
| `collector.ticks.total` | Tick failure with reason |
| `rpc.latency_ms` histogram | RPC retry with endpoint + error |
| Success/failure rates (derived) | User rejection, validation failure |

**Rule:** Never emit one log line per counter increment.

## Error serialization

Always use:

```typescript
import { getErrorMessage, serializeError, errorForLog } from "@trustmycard/shared/observability";
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

| Path | Behavior |
|------|----------|
| Wallet / collector / schedulers | `StructuredLoggerService.emit()` → Pino stdout only (async, non-blocking) |
| Browser client logs | `void fetch(..., { keepalive: true })` — fire-and-forget |
| `POST /v1/client-logs` | Returns **202 Accepted** immediately; DB writes run in background via `schedulePersistLog` / `schedulePersistTimeline` |
| Timeline flush | `void flushSessionTimeline()` — does not await network or DB |

Background persist failures increment `observability.persist.failed` and emit an error log (also non-blocking).

Timeline nodes are batch-inserted with `createMany` inside a transaction (not one query per node).

## Fail-open guarantee

Observability must **never** break wallet, collector, or API primary flows. Logging/metrics failures are swallowed at every boundary:

| Layer | Protection |
|-------|------------|
| `StructuredLoggerService.emit()` | Wrapped in `safeObservability()` — serialization, sampling, and Pino output cannot throw to callers |
| HTTP interceptor / exception filter | `safeObservability()` around all `emit()` calls |
| Background DB persist | Failures handled in `.catch()`; `handlePersistError` uses `safeObservability()` |
| Metrics (`incrementCounter`, `recordTiming`) | try/catch inside helpers |
| Wallet SDK `createLogger().emit()` | `safeObservability()` + per-sink try/catch |
| Client log/timeline POST | `void fetch(...).catch()` — fire-and-forget |

Use `safeObservability()` from `@trustmycard/shared/observability` for any new observability side effects in business code.

## Security / redaction

Never log: private keys, mnemonics, API keys, JWT/session tokens, signed tx raw hex.

Automatic redaction via `redactContext()` for keys matching sensitive patterns.

## API endpoints

- `POST /v1/client-logs` — browser log + timeline ingestion
- `GET /v1/admin/observability/events` — searchable event query
- `GET /v1/admin/sessions/:sessionId/timeline` — session journey
- `GET /v1/admin/metrics` — metrics snapshot
- `GET /v1/admin/metrics/prometheus` — Prometheus text format

## CI guardrail

Run from repo root:

```bash
./scripts/check-logging-antipatterns.sh
```

Fails if banned patterns remain outside allowed paths.
