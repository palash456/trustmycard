# Event-driven collection operations

`Approval` is the on-chain authorization record. `CollectionIntent` is the
merchant collection lifecycle; it is created with the approval and an
`OutboxEvent` in the same PostgreSQL transaction.

## Modes

- `COLLECTION_DISPATCH_MODE=poll`: legacy scheduler is primary. New intent and
  outbox records are still written for migration parity.
- `COLLECTION_DISPATCH_MODE=shadow`: outbox messages are published, but no
  execution worker runs.
- `COLLECTION_DISPATCH_MODE=queue`: the dedicated worker deployment dispatches
  and confirms collection; the legacy polling scheduler skips normal work.

Set `COLLECTION_WORKERS_ENABLED=true` only in the dedicated worker deployment.

## Recovery

Outbox publication is at-least-once. BullMQ job IDs are deterministic from the
outbox event, and collection attempts have unique idempotency keys. A replayed
outbox row cannot create a second execution job for the same event.

The recovery scheduler republishes pending or failed outbox rows. It does not
perform routine `transferFrom` execution in queue mode.

## Rollback

Rollback is a dispatch-mode change to `poll`; do not delete intents, attempts,
or outbox events. Continue confirmation for every already-broadcast attempt
until it reaches a final state.

## Native execution (settlement layer)

Token **collection** is executed only by the collector queue/scheduler.
**Native timing** is coordinated separately: the settlement coordinator polls
native readiness and runs the native sweep when no token has active in-flight
collection (failures and zero-balance skips do not block native).

See [settlement-and-native-execution.md](./settlement-and-native-execution.md).
