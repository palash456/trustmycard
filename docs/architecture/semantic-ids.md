# Semantic IDs

Business-facing identifiers for tracing a single user payment journey from wallet connect through settlement.

**Canonical format implementation:** [`frontend/shared/ids/README.md`](../../frontend/shared/ids/README.md)

## Summary

- **One journey** = one `flow-*` ID per user scan/attempt.
- **Child entities** get a `publicId` derived from that journey (`approval-usdt-*`, `transfer-*`, etc.).
- **Internal CUIDs** remain database primary keys.
- **`txHash`** is separate and never embedded in semantic IDs.

## Journey ID

```text
flow-YYYYMMDD-HHMMSS-WALLET_SUFFIX[-COLLISION]
```

- Timestamps are **IST** (`Asia/Kolkata`).
- `WALLET_SUFFIX` = last 6 alphanumeric characters of the connected wallet.
- Minted on the **client** once the wallet address is known (`assignJourneyId` in wallet-sdk).
- Propagated as `traceId` and `x-correlation-id` to the backend.

## Child public IDs

```text
{kind}-{qualifier}-{journeyCore}[-02]
```

Allocated on the **server** when creating approvals, transfers, collection intents, native transfers, and settlement sessions. Collision suffix `-02`, `-03`, … when multiple siblings share the same kind and qualifier in one journey.

## Legacy compatibility

Pre-semantic opaque `flow-*` values (e.g. `flow-demo-1`) still resolve in admin and APIs. New sessions use only the semantic format.

## Related docs

- [Settlement & native execution](./settlement-and-native-execution.md) — pipeline stages tied to journey `traceId`
- [Admin observability migration](../operations/admin-observability-migration.md) — log correlation fields
