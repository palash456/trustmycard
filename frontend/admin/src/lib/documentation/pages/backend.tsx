import {
  DocCode,
  DocP,
  DocTable,
  DocUl,
  DocLi,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const backendPage: DocPage = {
  slug: "backend",
  title: "Backend Structure",
  description:
    "NestJS modules, services, entry points, and where business logic lives.",
  keywords: [
    "nestjs",
    "wallet.service",
    "modules",
    "prisma",
    "main.ts",
    "worker.ts",
  ],
  sections: [
    {
      id: "entry-points",
      title: "Entry points",
      content: (
        <DocTable
          headers={["File", "Role"]}
          rows={[
            [
              "backend/src/main.ts",
              "HTTP API bootstrap (port 4000, prefix v1)",
            ],
            ["backend/src/worker.ts", "Worker process bootstrap"],
            [
              "backend/src/resolve-app-module.ts",
              "SERVICE_ROLE module selection",
            ],
            ["backend/src/app-core.module.ts", "Shared domain module imports"],
          ]}
        />
      ),
    },
    {
      id: "modules",
      title: "Modules",
      content: (
        <DocTable
          headers={["Module", "Path", "Responsibility"]}
          rows={[
            [
              "wallet",
              "modules/wallet/",
              "Approvals, collection, native transfers, settlement, balances, TRON/EVM",
            ],
            [
              "collections",
              "modules/collections/",
              "CollectionIntent + transactional outbox",
            ],
            [
              "admin",
              "modules/admin/",
              "Dashboard API, analytics, pipeline, journeys, activity",
            ],
            ["auth", "modules/auth/", "Wallet challenge/verify sessions"],
            ["custody", "modules/custody/", "Collection signing (env keys)"],
            [
              "resources",
              "modules/resources/",
              "TRON energy / EVM gas sponsorship",
            ],
            [
              "observability",
              "modules/observability/",
              "Client log/timeline ingestion",
            ],
            [
              "settings",
              "modules/settings/",
              "Public platform config endpoint",
            ],
          ]}
        />
      ),
    },
    {
      id: "key-services",
      title: "Key services",
      content: (
        <DocTable
          headers={["Service", "File", "Responsibility"]}
          rows={[
            [
              "WalletService",
              "wallet.service.ts (~3400 lines)",
              "Approvals, collector, broadcast/confirm collection",
            ],
            [
              "NativeTransferService",
              "native-transfer.service.ts",
              "Estimate, register, confirm, reconcile",
            ],
            [
              "NetworkSettlementService",
              "network-settlement.service.ts",
              "Multi-token settlement sessions",
            ],
            [
              "CollectionIntentService",
              "collection-intent.service.ts",
              "Idempotent intent creation + outbox",
            ],
            [
              "TransactionJourneyService",
              "transaction-journey.service.ts",
              "Journey aggregation for admin",
            ],
            [
              "PipelineBuilderService",
              "pipeline/pipeline-builder.service.ts",
              "User pipeline visualization",
            ],
            [
              "ObservabilityService",
              "observability.service.ts",
              "Persist client logs to ObservabilityEvent",
            ],
            [
              "PlatformConfigService",
              "config/platform-config.service.ts",
              "Typed platform env facade",
            ],
            [
              "ConfigService",
              "config/config.service.ts",
              "Runtime settings (env + AppSettings DB)",
            ],
          ]}
        />
      ),
    },
    {
      id: "infrastructure",
      title: "Infrastructure",
      content: (
        <DocTable
          headers={["Component", "Path"]}
          rows={[
            ["Prisma", "infrastructure/database/"],
            [
              "Structured logger",
              "infrastructure/logger/structured-logger.service.ts",
            ],
            ["Log sampling", "infrastructure/logger/log-sampler.service.ts"],
            ["Metrics", "infrastructure/metrics/ → /v1/admin/metrics"],
            ["Admin SSE events", "infrastructure/admin-events/"],
            [
              "Correlation middleware",
              "common/middleware/correlation.middleware.ts",
            ],
            ["Public ID helper", "common/ids/public-id.helper.ts"],
          ]}
        />
      ),
    },
    {
      id: "cross-cutting",
      title: "Cross-cutting concerns",
      content: (
        <DocUl>
          <DocLi>
            Global prefix <DocCode>v1</DocCode> on all HTTP routes.
          </DocLi>
          <DocLi>
            Throttling via <DocCode>THROTTLE_TTL_MS</DocCode> /{" "}
            <DocCode>THROTTLE_LIMIT</DocCode>.
          </DocLi>
          <DocLi>Global exception filter + logging interceptor.</DocLi>
          <DocLi>
            Swagger at <DocCode>/v1/docs</DocCode> when{" "}
            <DocCode>SWAGGER_ENABLED=true</DocCode>.
          </DocLi>
        </DocUl>
      ),
    },
    {
      id: "stub-modules",
      title: "Stub / health-only modules",
      content: (
        <DocP>
          users, wallets, balances, transfers, notifications, analytics, audit,
          approvals modules expose health endpoints only. Real logic lives in{" "}
          <DocCode>wallet</DocCode> and <DocCode>admin</DocCode> modules.
        </DocP>
      ),
    },
  ],
};
