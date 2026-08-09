import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLi,
  DocLink,
  DocP,
  DocPre,
  DocTable,
  DocUl,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const architecturePage: DocPage = {
  slug: "architecture",
  title: "Architecture",
  description:
    "High-level system design, process topology, blast-radius zones, and architectural decisions.",
  keywords: ["nestjs", "nextjs", "bff", "service role", "blast radius", "two-phase"],
  sections: [
    {
      id: "design-principles",
      title: "Design principles",
      content: (
        <DocUl>
          <DocLi>
            <strong>Two-phase authorization</strong> — minimize user-facing wallet popups; defer
            confirmation, collection, and EVM native to background settlement.
          </DocLi>
          <DocLi>
            <strong>Signing boundary</strong> — collection private keys exist only on worker
            processes, never on the public API tier.
          </DocLi>
          <DocLi>
            <strong>Semantic IDs</strong> — business-facing identifiers are human-readable; internal
            CUIDs stay in the database.
          </DocLi>
          <DocLi>
            <strong>Fail-open observability</strong> — client logging never blocks user flows.
          </DocLi>
          <DocLi>
            <strong>At-least-once collection</strong> — transactional outbox + BullMQ for queue mode;
            poll scheduler for legacy mode.
          </DocLi>
        </DocUl>
      ),
    },
    {
      id: "process-topology",
      title: "Process topology",
      content: (
        <>
          <DocPre>{`┌─────────────────┐     ┌─────────────────┐
│  website (BFF)  │────▶│  NestJS API     │
│  admin (BFF)    │     │  SERVICE_ROLE=api│
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              PostgreSQL      Redis      External RPC
                    ▲            ▲
                    │            │
              ┌─────┴────────────┴─────┐
              │  NestJS Workers        │
              │  SERVICE_ROLE=worker   │
              │  BullMQ + schedulers   │
              └────────────────────────┘`}</DocPre>
          <DocP>
            Entry points: <DocCode>backend/src/main.ts</DocCode> (HTTP),{" "}
            <DocCode>backend/src/worker.ts</DocCode> (workers). Module resolution in{" "}
            <DocCode>backend/src/resolve-app-module.ts</DocCode>.
          </DocP>
        </>
      ),
      subsections: [
        {
          id: "app-modules",
          title: "NestJS app modules",
          content: (
            <DocTable
              headers={["Module", "Includes", "Use"]}
              rows={[
                ["AppCoreModule", "Domain modules, Prisma, config", "Shared core"],
                ["ApiAppModule", "AppCore + ApiJobsModule", "Production API"],
                ["WorkerAppModule", "AppCore + WorkerJobsModule", "Production workers"],
                ["AppModule", "AppCore + ApiJobs + WorkerJobs", "Local all-in-one"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "blast-radius",
      title: "Blast-radius zones",
      content: (
        <DocTable
          headers={["Zone", "Components", "Isolation"]}
          rows={[
            ["A — Marketing", "Hostinger static", "No secrets, no API access"],
            ["B — Wallet app", "website + wallet-sdk BFF", "No signing keys; proxies to API"],
            ["C — API", "NestJS api role", "Admin key + wallet sessions; no collection keys"],
            ["D — Workers", "NestJS worker role", "Collection signing; no public HTTP"],
            ["E — Admin", "admin Next.js", "Session cookie + admin API key proxy"],
            ["F — Data", "Postgres + Redis", "Connection strings per environment"],
          ]}
        />
      ),
    },
    {
      id: "two-phase-model",
      title: "Two-phase authorization model",
      content: (
        <>
          <DocFlow
            steps={[
              "Wallet phase (user-visible): prepare → acquire resources → sign → broadcast for USDT/USDC; Tron native sign only; EVM native deferred.",
              "Settlement phase (background): wallet session auth → register NetworkSettlementSession → finalize approvals (confirm + persist + queue collection) → poll token collection idle → execute native.",
              "Terminal state recorded on client (sessionStorage) and server (ObservabilityEvent, entity statuses).",
            ]}
          />
          <DocCallout>
            Full detail: <DocLink href="/documentation/transaction-lifecycle">Transaction lifecycle</DocLink>
            . Implementation: <DocCode>wallet-sdk/src/authorization/session.ts</DocCode>,{" "}
            <DocCode>wallet-sdk/src/authorization/phases/settlement-coordinator.ts</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "collection-dispatch",
      title: "Collection dispatch modes",
      content: (
        <DocTable
          headers={["Mode", "Env", "Behavior"]}
          rows={[
            ["poll (default)", "COLLECTION_DISPATCH_MODE=poll", "ApprovalCollectionScheduler polls DB, calls WalletService.processMonitoredApproval()"],
            ["shadow", "COLLECTION_DISPATCH_MODE=shadow", "Poll + queue side-by-side for validation"],
            ["queue", "COLLECTION_DISPATCH_MODE=queue", "Outbox → BullMQ workers; requires COLLECTION_WORKERS_ENABLED=true"],
          ]}
        />
      ),
      subsections: [
        {
          id: "queue-flow",
          title: "Queue mode flow",
          content: (
            <DocPre>{`CollectionIntentService.create()
  → OutboxService (PENDING event)
  → OutboxPublisherService.publish()
  → collection-execution queue
  → CollectionExecutionWorker (sign/broadcast)
  → collection-confirmation queue
  → CollectionConfirmationWorker (confirm + settle)
  → MerchantWebhookWorker (optional)`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "bff-pattern",
      title: "BFF proxy pattern",
      content: (
        <DocP>
          Browser clients call relative <DocCode>/api/*</DocCode> on the website or admin Next.js
          apps. Server routes proxy to Nest at <DocCode>BACKEND_API_URL</DocCode> (default{" "}
          <DocCode>http://127.0.0.1:4000</DocCode>) via{" "}
          <DocCode>wallet-sdk/src/server/proxy-backend-api.ts</DocCode>. Proxies forward{" "}
          <DocCode>x-correlation-id</DocCode> (journey ID) and{" "}
          <DocCode>Authorization: Bearer</DocCode> wallet session tokens when required.
        </DocP>
      ),
    },
  ],
};
