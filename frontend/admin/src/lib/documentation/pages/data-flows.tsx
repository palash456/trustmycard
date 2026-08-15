import {
  DocFlow,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const dataFlowsPage: DocPage = {
  slug: "data-flows",
  title: "Data Flows",
  description:
    "How data moves between frontend, backend, database, workers, and external services.",
  keywords: ["data flow", "integration", "rpc", "proxy", "pipeline"],
  sections: [
    {
      id: "connect-flow",
      title: "Connect & authorize flow",
      content: (
        <DocPre>{`User Browser → website/ (product at /)
  → wallet-sdk (WalletConnect)
  → website BFF /api/*
  → Nest API /v1/api/*
  → PostgreSQL (Approval, WalletSession)
  → External RPC (EVM/TRON for balances, broadcast)`}</DocPre>
      ),
    },
    {
      id: "settlement-flow",
      title: "Settlement flow",
      content: (
        <DocFlow
          steps={[
            "wallet-sdk settlement-coordinator → BFF /api/network-settlement/register.",
            "NetworkSettlementService writes NetworkSettlementSession.",
            "Approval confirm → Approval row + CollectionIntent + OutboxEvent.",
            "Worker/collector → sign transferFrom → broadcast → confirm.",
            "Native readiness poll → NativeTransferService → RPC broadcast/confirm.",
            "ObservabilityService writes ObservabilityEvent for each stage.",
          ]}
        />
      ),
    },
    {
      id: "admin-flow",
      title: "Admin data flow",
      content: (
        <DocPre>{`Admin Browser → admin Next.js SSR
  → adminGetData() → /api/admin/*
  → Nest /v1/api/admin/*
  → PostgreSQL (read aggregations)
  → TransactionJourneyService joins entities by traceId`}</DocPre>
      ),
    },
    {
      id: "observability-flow",
      title: "Observability flow",
      content: (
        <DocFlow
          steps={[
            "wallet-sdk logger → client-log-batcher → BFF /api/client-logs.",
            "Nest ObservabilityController → ObservabilityService → ObservabilityEvent table.",
            "Admin timeline view reads grouped events by sessionId/traceId.",
            "Server structured logs include correlation ID from middleware.",
          ]}
        />
      ),
    },
    {
      id: "collection-flow",
      title: "Collection flow (queue mode)",
      content: (
        <DocPre>{`Approval confirmed → CollectionIntent created
  → OutboxEvent (PENDING)
  → OutboxPublisherService (worker)
  → Redis BullMQ collection-execution
  → CollectionExecutionWorker → sign + RPC broadcast
  → collection-confirmation queue
  → CollectionConfirmationWorker → update statuses
  → optional MerchantWebhookWorker → external HTTP`}</DocPre>
      ),
    },
    {
      id: "external-deps",
      title: "External dependencies",
      content: (
        <DocTable
          headers={["Service", "Used for"]}
          rows={[
            [
              "EVM RPC (chain providers)",
              "Balances, allowance verify, broadcast, confirm",
            ],
            ["TRON full node (TRONGRID)", "TRON balances, broadcast, energy"],
            [
              "TRON energy provider",
              "Resource sponsorship via ResourceManager",
            ],
            ["WalletConnect relay", "Wallet session transport"],
            [
              "Merchant webhook endpoint",
              "Collection completion notifications",
            ],
            [
              "Telegram (via tg-log)",
              "Operator alerts for scan/approve events",
            ],
          ]}
        />
      ),
    },
    {
      id: "third-party",
      title: "Third-party integrations",
      content: (
        <DocTable
          headers={["Integration", "Package / module"]}
          rows={[
            ["WalletConnect v2", "wallet-sdk providers"],
            ["ethers.js", "EVM signing verification, RPC"],
            ["TronWeb", "TRON operations"],
            ["BullMQ + ioredis", "backend queue workers"],
            ["Prisma", "PostgreSQL ORM"],
            ["Pino", "Server structured logging"],
          ]}
        />
      ),
    },
  ],
};
