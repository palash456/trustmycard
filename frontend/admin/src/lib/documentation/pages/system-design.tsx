import {
  DocCallout,
  DocCode,
  DocFlowChart,
  DocLayerStack,
  DocLink,
  DocP,
  DocPre,
  DocTable,
  DocUl,
  DocLi,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const systemDesignPage: DocPage = {
  slug: "system-design",
  title: "System Design & Tech Stack",
  description:
    "End-to-end technical system design: architecture layers, package map, tech stack choices, and flowcharts for how the platform works.",
  keywords: [
    "system design",
    "tech stack",
    "flowchart",
    "nestjs",
    "nextjs",
    "walletconnect",
    "prisma",
    "bullmq",
    "packages",
    "architecture",
  ],
  sections: [
    {
      id: "design-goals",
      title: "Design goals",
      content: (
        <>
          <DocP>
            Trust My Card is built as a TypeScript monorepo optimized for a
            wallet-linking product: fast user connect UX, safe background
            settlement, operable admin console, and clear separation between
            public API and signing workers.
          </DocP>
          <DocTable
            headers={["Goal", "How we achieve it"]}
            rows={[
              [
                "Minimize wallet popups",
                "Two-phase auth: wallet phase (sign) + background settlement (confirm, collect, native)",
              ],
              [
                "Protect signing keys",
                "SERVICE_ROLE split: API has no collection keys; workers sign transferFrom",
              ],
              [
                "End-to-end traceability",
                "Semantic flow-* journey IDs + traceId on all entities + observability events",
              ],
              [
                "Safe collection",
                "Transactional outbox + BullMQ queue mode; poll scheduler fallback",
              ],
              [
                "Shared correctness",
                "@trustmycard/shared package consumed by frontend and backend",
              ],
              [
                "Operability",
                "Admin panel with transaction journey hub, pipeline, audit timelines",
              ],
            ]}
          />
        </>
      ),
    },
    {
      id: "high-level-architecture",
      title: "High-level architecture",
      content: (
        <>
          <DocLayerStack
            layers={[
              {
                title: "Client surfaces",
                items: [
                  "website /connect",
                  "admin console",
                  "marketing (static)",
                  "WalletConnect mobile wallets",
                ],
                note: "Browser / mobile — no private keys on platform frontend",
              },
              {
                title: "BFF layer (Next.js)",
                items: [
                  "website /api/* routes",
                  "admin /api/admin/* proxy",
                  "wallet-sdk server routes",
                ],
                note: "Proxies to Nest; forwards x-correlation-id + wallet session Bearer",
              },
              {
                title: "Application layer (NestJS)",
                items: [
                  "WalletService",
                  "NetworkSettlementService",
                  "CollectionIntentService",
                  "TransactionJourneyService",
                  "ObservabilityService",
                ],
              },
              {
                title: "Background processing",
                items: [
                  "ApprovalCollectionScheduler",
                  "BullMQ workers",
                  "OutboxPublisherService",
                  "NativeTransferReconciliationScheduler",
                ],
                note: "SERVICE_ROLE=worker in production; signing enabled here only",
              },
              {
                title: "Data & messaging",
                items: [
                  "PostgreSQL (Prisma)",
                  "Redis (BullMQ)",
                  "ObservabilityEvent store",
                ],
              },
              {
                title: "External systems",
                items: [
                  "EVM RPC nodes",
                  "TRON full node / TronGrid",
                  "TRON energy provider",
                  "Merchant webhooks",
                  "Telegram (tg-log alerts)",
                ],
              },
            ]}
          />
          <DocPre title="Request path (simplified)">{`User wallet
  → WalletConnect (universal provider)
  → website Next.js BFF /api/*
  → NestJS /v1/api/*
  → Prisma → PostgreSQL
  → (async) Redis BullMQ → Worker → RPC broadcast → chain`}</DocPre>
        </>
      ),
    },
    {
      id: "monorepo-map",
      title: "Monorepo package map",
      content: (
        <DocTable
          headers={["Package", "Path", "Runtime", "Role"]}
          rows={[
            [
              "@trustmycard/website",
              "frontend/website",
              "Next.js :3000",
              "Wallet app shell + BFF; decoy / + product /connect",
            ],
            [
              "@trustmycard/admin",
              "frontend/admin",
              "Next.js :3002",
              "Operations console; SSR data via admin API proxy",
            ],
            [
              "@trustmycard/marketing",
              "frontend/marketing",
              "Next.js static :3001",
              "Public marketing site → Hostinger",
            ],
            [
              "@trustmycard/wallet-sdk",
              "frontend/wallet-sdk",
              "Library + server routes",
              "WalletConnect, approvals, settlement, BFF route handlers",
            ],
            [
              "@trustmycard/shared",
              "frontend/shared",
              "Compiled TS lib",
              "IDs, constants, observability schemas — shared by FE + BE",
            ],
            [
              "@trustmycard/backend",
              "backend",
              "NestJS :4000",
              "API + workers; Prisma; BullMQ; chain RPC",
            ],
          ]}
        />
      ),
      subsections: [
        {
          id: "dependency-graph",
          title: "Package dependency graph",
          content: (
            <DocPre>{`                    ┌─────────────┐
                    │   shared    │  ← constants, IDs, schemas
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ wallet-sdk │  │   admin    │  │  backend   │
    └─────┬──────┘  └────────────┘  └────────────┘
          │
          ▼
    ┌────────────┐       ┌────────────┐
    │  website   │       │ marketing  │  (no wallet-sdk)
    └────────────┘       └────────────┘`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "tech-stack",
      title: "Tech stack by layer",
      content: (
        <DocP>
          Every dependency below is from the actual{" "}
          <DocCode>package.json</DocCode> files in the repo. Versions reflect
          what is pinned today.
        </DocP>
      ),
      subsections: [
        {
          id: "frontend-stack",
          title: "Frontend stack",
          content: (
            <DocTable
              headers={["Technology", "Package(s)", "Why we use it"]}
              rows={[
                [
                  "Next.js 16",
                  "website, admin, marketing",
                  "App Router, SSR for admin, API routes as BFF proxy layer",
                ],
                [
                  "React 19",
                  "All frontend apps",
                  "UI framework; wallet-sdk peer dependency",
                ],
                [
                  "TypeScript 5",
                  "Entire monorepo",
                  "Type safety across shared package boundary",
                ],
                [
                  "Tailwind CSS 4",
                  "website, admin, marketing",
                  "Utility-first styling; admin uses shadcn/ui tokens",
                ],
                [
                  "shadcn/ui + Base UI",
                  "admin",
                  "Accessible component primitives (sidebar, sheet, table, etc.)",
                ],
                [
                  "next-themes",
                  "admin",
                  "Dark/light mode; default dark for ops console",
                ],
                [
                  "Nivo charts",
                  "admin",
                  "Analytics dashboard visualizations (@nivo/bar, line, pie)",
                ],
                [
                  "Lucide React",
                  "admin, website, marketing",
                  "Consistent icon set",
                ],
                [
                  "AOS",
                  "website",
                  "Scroll animations on decoy/marketing pages",
                ],
                [
                  "WalletConnect v2",
                  "wallet-sdk",
                  "@walletconnect/universal-provider + modal for QR connect",
                ],
              ]}
            />
          ),
        },
        {
          id: "backend-stack",
          title: "Backend stack",
          content: (
            <DocTable
              headers={["Technology", "Package", "Why we use it"]}
              rows={[
                [
                  "NestJS 11",
                  "@nestjs/*",
                  "Modular API framework; guards, interceptors, schedulers, DI",
                ],
                [
                  "Prisma 6",
                  "@prisma/client",
                  "Type-safe PostgreSQL ORM; migrations; schema as source of truth",
                ],
                [
                  "PostgreSQL",
                  "DATABASE_URL",
                  "Transactional store for approvals, intents, settlement, observability",
                ],
                [
                  "BullMQ 6",
                  "bullmq + ioredis",
                  "Reliable job queues for collection execution/confirmation/webhooks",
                ],
                [
                  "Redis",
                  "REDIS_URL",
                  "BullMQ backing store; required for queue dispatch mode",
                ],
                [
                  "ethers v5",
                  "ethers",
                  "EVM RPC, allowance verify, signature verify, tx broadcast",
                ],
                [
                  "TronWeb 6",
                  "tronweb",
                  "TRON broadcast, message verify, energy operations",
                ],
                [
                  "Pino",
                  "pino, nestjs-pino, pino-http",
                  "Structured JSON logging with sampling support",
                ],
                ["Zod", "zod", "Runtime validation at API boundaries"],
                [
                  "class-validator",
                  "class-validator, class-transformer",
                  "NestJS DTO validation",
                ],
                ["Helmet", "helmet", "HTTP security headers"],
                [
                  "Swagger",
                  "@nestjs/swagger",
                  "OpenAPI docs at /v1/docs when enabled",
                ],
                [
                  "Throttler",
                  "@nestjs/throttler",
                  "Rate limiting on public API routes",
                ],
              ]}
            />
          ),
        },
        {
          id: "shared-stack",
          title: "Shared package",
          content: (
            <DocTable
              headers={["Module", "Contents", "Why shared"]}
              rows={[
                [
                  "shared/ids",
                  "flow-id, public-id, IST formatting",
                  "Same journey ID rules on client and server",
                ],
                [
                  "shared/constants",
                  "transaction-lifecycle, settlement, token-collection-state",
                  "Identical state machine semantics everywhere",
                ],
                [
                  "shared/observability",
                  "LogEvent schema, status enums",
                  "Client logs match server observability shape",
                ],
                [
                  "shared/platform-config",
                  "Public config types",
                  "Frontend fetches same settings shape backend exposes",
                ],
              ]}
            />
          ),
        },
        {
          id: "infra-stack",
          title: "Infrastructure & tooling",
          content: (
            <DocTable
              headers={["Technology", "Use"]}
              rows={[
                ["Node.js ≥20", "Runtime for all services"],
                ["npm workspaces", "frontend/ monorepo package linking"],
                ["Render", "Production hosting (API, website, admin, workers)"],
                ["Hostinger", "Static marketing site"],
                ["Neon / Render Postgres", "Managed PostgreSQL"],
                ["Upstash / Render Redis", "Managed Redis for BullMQ"],
                [
                  "TMC_ENV profiles",
                  "env/profiles/{development,production-preview,production}",
                ],
                [
                  "dotenv + load-env.mjs",
                  "Layered env loading per service role",
                ],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "process-topology",
      title: "Process topology",
      content: (
        <>
          <DocPre title="Production (full split)">{`┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  website (BFF)   │   │   admin (BFF)    │   │ marketing static │
│  app.*.com       │   │  admin.*.com     │   │ trustmycard.com  │
└────────┬─────────┘   └────────┬─────────┘   └──────────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  NestJS API          │
         │  SERVICE_ROLE=api    │  ← no signing keys
         │  api.*.com/v1        │
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         ▼                      ▼
  ┌─────────────┐        ┌─────────────┐
  │ PostgreSQL  │        │    Redis    │
  └──────┬──────┘        └──────┬──────┘
         │                      │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  NestJS Workers      │
         │  SERVICE_ROLE=worker │  ← collection signing keys
         │  (no public HTTP)    │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  EVM RPC + TRON node │
         └──────────────────────┘`}</DocPre>
          <DocCallout variant="tip">
            Budget deploy uses <DocCode>SERVICE_ROLE=all</DocCode> (API +
            workers in one process) for ~$14/mo. Full deploy splits API and
            workers for blast-radius isolation.
          </DocCallout>
        </>
      ),
    },
    {
      id: "connect-flowchart",
      title: "Connect & authorize flowchart",
      content: (
        <>
          <DocFlowChart
            direction="vertical"
            nodes={[
              "User opens /connect → selects card tier",
              "beginTransaction() — sessionStorage shell",
              "WalletConnect QR → user connects wallet",
              "assignJourneyId() → mint flow-* ID",
              "scanWallet() → fetch balances, postTgLog(scan)",
              "User selects network",
              "WALLET PHASE: USDT approve → USDC approve → Tron native sign (EVM native deferred)",
              "UI shows connected; settlement starts in background",
              "SETTLEMENT: wallet session auth → register settlement session",
              "Finalize approvals (confirm + persist + queue collection)",
              "Poll token collection idle → execute native",
              "markTerminal(SUCCESS | FAILED)",
            ]}
          />
          <DocP>
            Implementation: <DocCode>useConnectFlow.ts</DocCode> →{" "}
            <DocCode>authorization/session.ts</DocCode> →{" "}
            <DocCode>authorization/phases/settlement-coordinator.ts</DocCode>.
            See{" "}
            <DocLink href="/documentation/transaction-lifecycle">
              Transaction lifecycle
            </DocLink>{" "}
            for detail.
          </DocP>
        </>
      ),
    },
    {
      id: "approval-pipeline",
      title: "Approval stage pipeline",
      content: (
        <>
          <DocP>
            Each token approval runs through a chain-agnostic stage machine:
          </DocP>
          <DocFlowChart
            nodes={[
              "PREPARE",
              "ACQUIRE_RESOURCES",
              "WAIT_RESOURCES_READY",
              "SIGN",
              "BROADCAST",
              "WAIT_CONFIRMATION",
              "VERIFY_APPROVAL",
              "PERSIST_APPROVAL",
              "POST_APPROVAL",
            ]}
          />
          <DocTable
            headers={["Preset", "Stages", "When"]}
            rows={[
              ["wallet", "PREPARE → BROADCAST", "User-visible wallet phase"],
              [
                "settlement",
                "WAIT_CONFIRMATION → POST_APPROVAL",
                "Background after wallet phase",
              ],
              ["full", "All stages", "Legacy / single-pass flows"],
            ]}
          />
          <DocP>
            EVM optimization: when 2+ tokens on same chain, tries EIP-5792{" "}
            <DocCode>wallet_sendCalls</DocCode> → Multicall3 → sequential
            fallback.
          </DocP>
        </>
      ),
    },
    {
      id: "collection-flowchart",
      title: "Token collection flowchart",
      content: (
        <>
          <DocPre title="Poll mode (default)">{`Approval confirmed + collectionEnabled
  → ApprovalCollectionScheduler polls DB
  → lease approval row (CollectorLease per network)
  → WalletService.processMonitoredApproval()
  → sign transferFrom (worker keys)
  → broadcast → confirm on-chain
  → update Approval.collectedRaw + CollectionIntent status`}</DocPre>
          <DocPre title="Queue mode">{`Approval confirmed
  → CollectionIntentService.create()
  → OutboxEvent (PENDING) in same DB transaction
  → OutboxPublisherService claims outbox
  → BullMQ collection-execution job
  → CollectionExecutionWorker: broadcast
  → BullMQ collection-confirmation job
  → CollectionConfirmationWorker: confirm + settle
  → optional MerchantWebhookWorker`}</DocPre>
          <DocP>
            Dispatch controlled by <DocCode>COLLECTION_DISPATCH_MODE</DocCode>:
            poll → shadow → queue. See{" "}
            <DocLink href="/documentation/workers-and-queues">
              Workers & Queues
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "settlement-flowchart",
      title: "Network settlement flowchart",
      content: (
        <DocFlowChart
          direction="vertical"
          nodes={[
            "Wallet phase complete → capture WalletPhaseCapture",
            "POST /network-settlement/register → NetworkSettlementSession created",
            "Status: WALLET_PHASE_COMPLETE",
            "Finalize USDT approval (settlement preset)",
            "Finalize USDC approval",
            "Status: COLLECTING_TOKENS — poll native-readiness",
            "All tokens idle → Status: AWAITING_NATIVE",
            "Tron: server broadcasts deferred signed tx | EVM: NativeTransferOrchestrator",
            "Status: COMPLETED or FAILED",
          ]}
        />
      ),
      subsections: [
        {
          id: "native-gating",
          title: "Native execution gate",
          content: (
            <DocP>
              Native cannot run while any token is <DocCode>pending</DocCode>,{" "}
              <DocCode>collecting</DocCode>, or{" "}
              <DocCode>failed_retry_scheduled</DocCode>. Gating logic in{" "}
              <DocCode>shared/constants/token-collection-state.ts</DocCode> (
              <DocCode>canExecuteNativeFromSnapshots()</DocCode>).
            </DocP>
          ),
        },
      ],
    },
    {
      id: "admin-observability-flow",
      title: "Admin & observability flow",
      content: (
        <DocPre>{`wallet-sdk logger
  → client-log-batcher (40 events / 400ms)
  → BFF POST /api/client-logs
  → Nest ObservabilityService
  → ObservabilityEvent table (traceId = flow-*)

Admin SSR page
  → adminGetData(/admin/transactions/{flow-*})
  → TransactionJourneyService aggregates:
      Approvals, CollectionIntents, Transfers,
      NetworkSettlementSessions, NativeTransfers,
      ObservabilityEvents, TgLogEvents, Pipeline

Admin timeline
  → GET /admin/sessions/{flow-*}/timeline
  → grouped ObservabilityEvent chronology`}</DocPre>
      ),
    },
    {
      id: "id-correlation-design",
      title: "ID & correlation design",
      content: (
        <DocFlowChart
          nodes={[
            "Wallet address known",
            "generateFlowId() → flow-YYYYMMDD-HHMMSS-SUFFIX",
            "x-correlation-id header on all API calls",
            "traceId stored on server entities",
            "Server allocates publicId on create (approval-usdt-*, etc.)",
            "Admin resolves by flow-* or publicId",
          ]}
        />
      ),
      subsections: [
        {
          id: "why-semantic-ids",
          title: "Why semantic IDs",
          content: (
            <DocUl>
              <DocLi>
                Support can reference a human-readable journey ID without DB
                lookup.
              </DocLi>
              <DocLi>
                IST timestamp embedded for chronological sorting and debugging.
              </DocLi>
              <DocLi>
                Wallet suffix ties ID to owner without exposing full address.
              </DocLi>
              <DocLi>
                Internal CUIDs remain as DB PKs; publicId is the admin-facing
                label.
              </DocLi>
            </DocUl>
          ),
        },
      ],
    },
    {
      id: "security-boundaries",
      title: "Security boundaries",
      content: (
        <DocTable
          headers={["Boundary", "What is isolated", "Mechanism"]}
          rows={[
            [
              "Signing",
              "Collection private keys",
              "SERVICE_ROLE=worker only; COLLECTION_SIGNING_ENABLED",
            ],
            [
              "Admin API",
              "Backend admin endpoints",
              "x-admin-api-key; injected by BFF, never in browser",
            ],
            [
              "Wallet API",
              "Owner-scoped mutations",
              "WalletSessionGuard + Bearer token from challenge/verify",
            ],
            ["Marketing", "No secrets, no API", "Static export to Hostinger"],
            [
              "CORS",
              "Cross-origin API access",
              "APP_ORIGIN + ADMIN_ORIGIN whitelist",
            ],
            [
              "Rate limit",
              "Public API abuse",
              "@nestjs/throttler global guard",
            ],
          ]}
        />
      ),
    },
    {
      id: "why-these-choices",
      title: "Key architectural decisions",
      content: (
        <DocTable
          headers={["Decision", "Choice", "Rationale"]}
          rows={[
            [
              "Monorepo layout",
              "frontend/ workspaces + backend/",
              "Share types via @trustmycard/shared without publishing",
            ],
            [
              "BFF pattern",
              "Next.js /api/* proxies",
              "Hide admin API key; same-origin for wallet SDK; forward correlation headers",
            ],
            [
              "Two-phase auth",
              "Wallet phase + settlement",
              "Fewer popups; EVM native deferred until tokens collected",
            ],
            [
              "Outbox pattern",
              "OutboxEvent + BullMQ",
              "At-least-once collection without losing intents on crash",
            ],
            [
              "Poll fallback",
              "ApprovalCollectionScheduler",
              "Works without Redis for budget/small deploys",
            ],
            [
              "Prisma over raw SQL",
              "Prisma ORM",
              "Type-safe models; migration history; shared schema reference",
            ],
            [
              "ethers v5 (not v6)",
              "ethers@5.8",
              "Stable TronWeb/EVM integration already built on v5 API",
            ],
            [
              "Semantic flow IDs",
              "flow-* client-minted",
              "Traceability without DB round-trip before first API call",
            ],
            [
              "NestJS modules",
              "wallet + admin + collections",
              "Clear domain boundaries; testable services",
            ],
            [
              "Admin SSR",
              "Server components + adminGetData",
              "No API key in browser; fast initial page load",
            ],
          ]}
        />
      ),
    },
    {
      id: "data-model-overview",
      title: "Data model overview",
      content: (
        <DocPre>{`Approval (allowance on-chain)
  ├── CollectionIntent (merchant collection request)
  │     ├── TransferAttempt (broadcast/confirm attempts)
  │     ├── OutboxEvent (queue dispatch)
  │     └── MerchantWebhookDelivery
  └── Transfer (legacy direct transfer)

NetworkSettlementSession (per network, per journey)
  ├── references USDT/USDC Approval rows
  └── references NativeTransfer

WalletSession (challenge/verify auth)
ObservabilityEvent (structured logs/timeline)
TgLogEvent (operator alerts)
AppSettings (runtime DB overrides)
CollectorLease (per-network collector lock)`}</DocPre>
      ),
    },
    {
      id: "related-docs",
      title: "Related documentation",
      content: (
        <DocUl>
          <DocLi>
            <DocLink href="/documentation/architecture">Architecture</DocLink> —
            module topology and dispatch modes
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/data-flows">Data Flows</DocLink> —
            inter-service data movement
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/transaction-lifecycle">
              Transaction Lifecycle
            </DocLink>{" "}
            — step-by-step journey
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/workers-and-queues">
              Workers & Queues
            </DocLink>{" "}
            — BullMQ and schedulers
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/api#swagger">
              API Reference → Swagger
            </DocLink>{" "}
            — interactive API explorer
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/admin-panel">
              Admin Panel Guide
            </DocLink>{" "}
            — full console usage guide
          </DocLi>
        </DocUl>
      ),
    },
  ],
};
