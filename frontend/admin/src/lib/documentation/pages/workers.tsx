import {
  DocCallout,
  DocCode,
  DocFlow,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const workersPage: DocPage = {
  slug: "workers-and-queues",
  title: "Workers, Queues & Jobs",
  description: "BullMQ queues, schedulers, collection workers, webhooks, and background reconciliation.",
  keywords: ["bullmq", "redis", "scheduler", "outbox", "webhook", "collector"],
  sections: [
    {
      id: "overview",
      title: "Overview",
      content: (
        <DocP>
          Background work runs in <DocCode>SERVICE_ROLE=worker</DocCode> processes. Redis (
          <DocCode>REDIS_URL</DocCode>) backs BullMQ queues. Entry:{" "}
          <DocCode>backend/src/worker.ts</DocCode>, module:{" "}
          <DocCode>backend/src/worker-app.module.ts</DocCode>.
        </DocP>
      ),
    },
    {
      id: "queues",
      title: "Queue names",
      content: (
        <DocTable
          headers={["Queue", "Worker", "Role"]}
          rows={[
            ["collection-execution", "CollectionExecutionWorker", "Sign + broadcast collection"],
            ["collection-confirmation", "CollectionConfirmationWorker", "Confirm on-chain"],
            ["collection-webhook", "MerchantWebhookWorker", "HMAC webhook POSTs"],
            ["collection-dlq", "—", "Dead-letter queue"],
          ]}
        />
      ),
    },
    {
      id: "schedulers",
      title: "Schedulers",
      content: (
        <DocTable
          headers={["Scheduler", "File", "Role"]}
          rows={[
            ["ApprovalCollectionScheduler", "schedulers/approval-collection.scheduler.ts", "Poll-mode collector; leases approvals"],
            ["NativeTransferReconciliationScheduler", "schedulers/native-transfer-reconciliation.scheduler.ts", "Reconcile pending native transfers"],
            ["CollectionRecoveryScheduler", "schedulers/collection-recovery.scheduler.ts", "Replay stuck outbox (queue mode)"],
            ["OutboxPublisherService", "workers/outbox-publisher.service.ts", "Claim OutboxEvent → enqueue BullMQ"],
          ]}
        />
      ),
    },
    {
      id: "dispatch-modes",
      title: "Collection dispatch modes",
      content: (
        <DocTable
          headers={["Mode", "Env var", "Behavior"]}
          rows={[
            ["poll", "COLLECTION_DISPATCH_MODE=poll", "Scheduler polls DB, processMonitoredApproval()"],
            ["shadow", "COLLECTION_DISPATCH_MODE=shadow", "Poll + queue in parallel"],
            ["queue", "COLLECTION_DISPATCH_MODE=queue", "Outbox → BullMQ; COLLECTION_WORKERS_ENABLED=true"],
          ]}
        />
      ),
    },
    {
      id: "queue-flow",
      title: "Queue mode step-by-step",
      content: (
        <DocFlow
          steps={[
            "CollectionIntentService.create() writes CollectionIntent + OutboxEvent (PENDING).",
            "OutboxPublisherService claims outbox rows and enqueues collection-execution job.",
            "CollectionExecutionWorker calls wallet.broadcastCollectionIntent() → enqueues confirmation.",
            "CollectionConfirmationWorker calls wallet.confirmCollectionAttempt() → settles intent.",
            "MerchantWebhookWorker POSTs HMAC-signed payload if MERCHANT_WEBHOOK_URL configured.",
          ]}
        />
      ),
    },
    {
      id: "collector-config",
      title: "Collector configuration",
      content: (
        <DocPre>{`COLLECTOR_ENABLED, COLLECTOR_INTERVAL_MS, COLLECTOR_BATCH_SIZE
COLLECTOR_LEASE_MS, COLLECTOR_MAX_RUNS, COLLECTOR_RPC_TIMEOUT_MS
COLLECTION_SUBMITTED_GRACE_MS, COLLECTION_FAILURE_BACKOFF_MAX
COLLECTION_QUEUE_CONCURRENCY, COLLECTION_CONFIRMATION_CONCURRENCY
OUTBOX_PUBLISH_INTERVAL_MS, COLLECTION_RECOVERY_INTERVAL_MS`}</DocPre>
      ),
    },
    {
      id: "webhooks",
      title: "Merchant webhooks",
      content: (
        <DocP>
          <DocCode>MERCHANT_WEBHOOK_URL</DocCode>, <DocCode>MERCHANT_WEBHOOK_SECRET</DocCode>,{" "}
          <DocCode>MERCHANT_WEBHOOK_TIMEOUT_MS</DocCode>,{" "}
          <DocCode>MERCHANT_WEBHOOK_CONCURRENCY</DocCode>. Delivery state in{" "}
          <DocCode>MerchantWebhookDelivery</DocCode> table. Retries with backoff.
        </DocP>
      ),
    },
    {
      id: "signing-boundary",
      title: "Signing boundary",
      content: (
        <DocCallout variant="warning">
          <DocCode>COLLECTION_SIGNING_ENABLED</DocCode> must be false on API role and true on worker
          role. Keys: <DocCode>ADMIN_EVM_PRIVATE_KEY</DocCode>, <DocCode>ADMIN_TRON_PRIVATE_KEY</DocCode>.
          Signer: <DocCode>modules/custody/env-collection-signer.service.ts</DocCode>.
        </DocCallout>
      ),
    },
    {
      id: "debugging",
      title: "How to debug",
      content: (
        <DocFlow
          steps={[
            "Check admin System page for collector status and queue health.",
            "GET /admin/collections/status for dispatch mode and queue depths.",
            "Inspect OutboxEvent rows with status PENDING or locked.",
            "Review worker logs for CollectionExecutionWorker / ConfirmationWorker errors.",
            "Use admin DLQ endpoint and collections/intents/:id/retry for recovery.",
          ]}
        />
      ),
    },
  ],
};
