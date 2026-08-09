import {
  DocCode,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const databasePage: DocPage = {
  slug: "database",
  title: "Database & Schema",
  description:
    "PostgreSQL models, enums, traceId/publicId columns, and relationships.",
  keywords: [
    "prisma",
    "postgresql",
    "schema",
    "approval",
    "collection intent",
    "migration",
  ],
  sections: [
    {
      id: "source-of-truth",
      title: "Source of truth",
      content: (
        <DocP>
          Schema: <DocCode>backend/prisma/schema.prisma</DocCode>. Migrations in{" "}
          <DocCode>backend/prisma/migrations/</DocCode>. Client generated via{" "}
          <DocCode>npx prisma generate</DocCode>.
        </DocP>
      ),
    },
    {
      id: "core-models",
      title: "Core transaction models",
      content: (
        <DocTable
          headers={["Model", "Key fields", "Purpose"]}
          rows={[
            [
              "Approval",
              "ownerAddress, spenderAddress, network, tokenSymbol, amountRaw, status, traceId, publicId, collectionEnabled",
              "On-chain allowance lifecycle",
            ],
            [
              "CollectionIntent",
              "approvalId, idempotencyKey, requestedRaw, settledRaw, status, traceId, publicId",
              "Merchant collection request",
            ],
            [
              "Transfer",
              "approvalId, idempotencyKey, amountRaw, txHash, status, publicId",
              "Direct transfer record",
            ],
            [
              "TransferAttempt",
              "collectionIntentId, sequence, txHash, status, signedPayload",
              "Per-attempt broadcast/confirm",
            ],
            [
              "OutboxEvent",
              "aggregateType, aggregateId, eventType, payload, status",
              "Transactional outbox for queue mode",
            ],
            [
              "MerchantWebhookDelivery",
              "collectionIntentId, eventId, endpoint, status",
              "Webhook delivery state",
            ],
          ]}
        />
      ),
    },
    {
      id: "wallet-settlement-models",
      title: "Wallet & settlement models",
      content: (
        <DocTable
          headers={["Model", "Key fields", "Purpose"]}
          rows={[
            [
              "WalletSession",
              "address, network, challenge, sessionToken, expiresAt",
              "Wallet auth sessions",
            ],
            [
              "NativeTransfer",
              "ownerAddress, network, assetSymbol, amountRaw, txHash, status, traceId, publicId",
              "Native coin transfers",
            ],
            [
              "NetworkSettlementSession",
              "clientSessionId, ownerAddress, network, status, tokenPlan, traceId, publicId",
              "Two-phase settlement per network",
            ],
            [
              "ResourceSponsorship",
              "network, address, resource, purpose, status, provider",
              "TRON energy / EVM gas",
            ],
          ]}
        />
      ),
    },
    {
      id: "ops-models",
      title: "Operations & observability models",
      content: (
        <DocTable
          headers={["Model", "Purpose"]}
          rows={[
            ["AuditLog", "Admin action audit trail"],
            ["CollectorLease", "Per-network collector lease (network PK)"],
            ["TgLogEvent", "Telegram-style client events"],
            ["AppSettings", "Runtime DB overrides (key/value JSON)"],
            [
              "ObservabilityEvent",
              "Structured client/server observability events",
            ],
            ["MetricsSnapshot", "Periodic metrics payload snapshots"],
          ]}
        />
      ),
    },
    {
      id: "enums",
      title: "Status enums",
      content: (
        <DocPre>{`ApprovalStatus, TransferStatus, CollectionIntentStatus,
TransferAttemptStatus, OutboxEventStatus, NetworkSettlementStatus`}</DocPre>
      ),
    },
    {
      id: "trace-public-columns",
      title: "traceId and publicId columns",
      content: (
        <DocP>
          Added for journey correlation and semantic IDs. Models with{" "}
          <DocCode>traceId</DocCode>: Approval, CollectionIntent,
          NativeTransfer, NetworkSettlementSession, TgLogEvent,
          ObservabilityEvent. Models with <DocCode>publicId</DocCode> (unique):
          Approval, Transfer, CollectionIntent, NativeTransfer,
          NetworkSettlementSession. Migration:{" "}
          <DocCode>20260809120000_add_trace_id_columns</DocCode>,{" "}
          <DocCode>20260809143000_add_semantic_public_ids</DocCode>.
        </DocP>
      ),
      subsections: [
        {
          id: "indexes",
          title: "Key indexes",
          content: (
            <DocP>
              <DocCode>@@index([traceId])</DocCode> on Approval,
              CollectionIntent. Collection polling:{" "}
              <DocCode>
                @@index([collectionEnabled, status, nextCheckAt])
              </DocCode>
              . Outbox: <DocCode>@@index([status, createdAt])</DocCode>.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "relationships",
      title: "Key relationships",
      content: (
        <DocPre>{`Approval 1──* CollectionIntent 1──* TransferAttempt
Approval 1──* Transfer
CollectionIntent 1──* OutboxEvent
CollectionIntent 1──* MerchantWebhookDelivery
NetworkSettlementSession → references approvals + nativeTransferId`}</DocPre>
      ),
    },
  ],
};
