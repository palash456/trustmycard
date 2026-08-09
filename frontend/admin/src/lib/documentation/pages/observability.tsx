import {
  DocCode,
  DocFlow,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const observabilityPage: DocPage = {
  slug: "observability",
  title: "Logging & Observability",
  description: "Three pillars (logs, metrics, timelines), schemas, sampling, and admin integration.",
  keywords: ["logs", "metrics", "timeline", "observability", "client-logs", "traceId"],
  sections: [
    {
      id: "three-pillars",
      title: "Three pillars",
      content: (
        <DocTable
          headers={["Pillar", "Storage", "Access"]}
          rows={[
            ["Logs", "ObservabilityEvent table + structured server logs", "Admin Audit, observability/events, log deep-links"],
            ["Metrics", "MetricsSnapshot + Prometheus endpoint", "/admin/metrics, dashboard"],
            ["Timelines", "ObservabilityEvent grouped by sessionId", "/audit/timeline/{sessionId}"],
          ]}
        />
      ),
    },
    {
      id: "log-schema",
      title: "Log event schema",
      content: (
        <DocP>
          Shared schema: <DocCode>frontend/shared/observability/schemas.ts</DocCode>. Key fields:
          module, operation, stage, status, traceId/transactionId, walletAddress, network, token,
          txHash, durationMs, error, samplingInfo.
        </DocP>
      ),
      subsections: [
        {
          id: "log-statuses",
          title: "Log statuses",
          content: (
            <DocPre>{`started, in_progress, success, failure, user_rejection,
partial_success, skipped, timeout, cancelled`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "client-logging",
      title: "Client logging (wallet-sdk)",
      content: (
        <DocTable
          headers={["Layer", "File", "Behavior"]}
          rows={[
            ["Structured logger", "observability/logger.ts", "Sampling, redaction, metrics"],
            ["Connect logger", "observability/connect-logger.ts", "Step-mapped LogEvents"],
            ["Session timeline", "observability/session-timeline.ts", "Flush on auth complete"],
            ["Log batcher", "observability/client-log-batcher.ts", "Batch 40 events / 400ms → /api/client-logs"],
            ["Telegram", "core/tg-log-client.ts", "Scan/approve/rejection alerts"],
          ]}
        />
      ),
    },
    {
      id: "server-logging",
      title: "Server logging",
      content: (
        <DocTable
          headers={["Component", "File"]}
          rows={[
            ["Structured logger", "backend/src/infrastructure/logger/structured-logger.service.ts"],
            ["Log sampler", "backend/src/infrastructure/logger/log-sampler.service.ts"],
            ["Correlation middleware", "backend/src/common/middleware/correlation.middleware.ts"],
            ["Observability ingest", "backend/src/modules/observability/observability.service.ts"],
          ]}
        />
      ),
    },
    {
      id: "correlation",
      title: "Correlation",
      content: (
        <DocP>
          HTTP <DocCode>x-correlation-id</DocCode> header = journey <DocCode>flow-*</DocCode> ID.
          Stored as <DocCode>traceId</DocCode> on ObservabilityEvent and entity rows. Admin log
          links built via <DocCode>lib/log-links.ts</DocCode> (transactionLogsLink, auditTimelineLink).
        </DocP>
      ),
    },
    {
      id: "sampling",
      title: "Sampling & fail-open",
      content: (
        <DocP>
          <DocCode>LOG_SAMPLING_ENABLED</DocCode> controls server-side sampling. Client logging is
          fail-open — errors in log delivery never block user flows. Batcher drops on network failure
          silently after retry.
        </DocP>
      ),
    },
    {
      id: "settlement-events",
      title: "Settlement observability",
      content: (
        <DocP>
          Settlement module emits structured events tracked in{" "}
          <DocCode>backend/src/modules/wallet/settlement-observability.ts</DocCode>. Admin settlement
          panels and pipeline views consume these events.
        </DocP>
      ),
    },
    {
      id: "debugging",
      title: "How to debug",
      content: (
        <DocFlow
          steps={[
            "Get flow-* ID from Transactions or client sessionStorage.",
            "Open /audit/timeline/{flow-*} for chronological event view.",
            "Use observability/events API with traceId filter.",
            "Check server logs with correlation ID from middleware.",
            "For settlement: NetworkSettlementSession detail + settlement observability events.",
          ]}
        />
      ),
    },
  ],
};
