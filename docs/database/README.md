# Database

Prisma schema, migrations, indexing, and data-lifecycle notes.

Source of truth for persistence models: `backend/prisma/schema.prisma`.

## Settlement session

`NetworkSettlementSession` tracks two-phase authorization per
`(clientSessionId, network)`:

| Field | Purpose |
|-------|---------|
| `tokenPlan` (JSON) | Per-token `shouldAttemptTransfer` + approve tx hash from wallet phase |
| `usdtApprovalTxHash` / `usdcApprovalTxHash` | On-chain approve references |
| `nativeAuthKind` / `nativeAuthPayload` | Tron deferred native broadcast |
| `nativeReady` | Last evaluated `canExecuteNative` |
| `status` | `WALLET_PHASE_COMPLETE` → … → `COMPLETED` / `FAILED` |

Migration: `20260805130000_settlement_token_plan` adds `tokenPlan`.

Related: [settlement-and-native-execution.md](../architecture/settlement-and-native-execution.md).
