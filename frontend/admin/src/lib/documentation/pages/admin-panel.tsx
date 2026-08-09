import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocTable,
  DocUl,
  DocLi,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const adminPanelPage: DocPage = {
  slug: "admin-panel",
  title: "Admin Panel Guide",
  description:
    "Complete guide to using the admin console: every page, data modes, status states, filters, and operational workflows.",
  keywords: [
    "admin",
    "dashboard",
    "demo mode",
    "transactions",
    "pipeline",
    "activity",
    "guide",
    "status",
    "badge",
    "filters",
  ],
  sections: [
    {
      id: "getting-started",
      title: "Getting started",
      content: (
        <>
          <DocP>
            The admin panel runs at <DocCode>localhost:3002</DocCode> locally
            and <DocCode>admin.trustmycard.com</DocCode> in production. Log in
            at <DocCode>/login</DocCode> with the admin password configured in
            your environment. All routes except <DocCode>/login</DocCode>{" "}
            require an authenticated session cookie.
          </DocP>
          <DocFlow
            steps={[
              "Open /login and enter the admin password.",
              "Check the data mode badge in the header (Demo / Dev / Production).",
              "Use the sidebar to navigate — Dashboard for ops overview, Transactions for journey tracing.",
              "Use the account menu (avatar) to switch data source, refresh, toggle theme, or open Settings.",
            ]}
          />
        </>
      ),
    },
    {
      id: "header-controls",
      title: "Header controls",
      content: (
        <DocTable
          headers={["Control", "Location", "What it does"]}
          rows={[
            [
              "Data mode badge",
              "Header left of avatar",
              "Read-only pill: Demo (amber), Dev (violet), Production (sky)",
            ],
            [
              "Account menu → Data source",
              "Avatar dropdown",
              "Switch between Demo, Dev, and Production data",
            ],
            [
              "Refresh",
              "Avatar dropdown",
              "Full server-side page refresh (re-fetches SSR data)",
            ],
            [
              "Theme",
              "Avatar dropdown",
              "Toggle light / dark mode (default dark)",
            ],
            ["App settings", "Avatar dropdown", "Navigate to /settings"],
            ["Log out", "Avatar dropdown", "Clears session → /login"],
            [
              "Sidebar trigger",
              "Header left",
              "Collapse / expand sidebar navigation",
            ],
          ]}
        />
      ),
    },
    {
      id: "data-modes",
      title: "Data modes",
      content: (
        <DocTable
          headers={["Mode", "Badge", "Data source", "When to use"]}
          rows={[
            [
              "Demo",
              "Demo (amber)",
              "Fixtures in demo/fixtures.ts — no live DB",
              "Training, UI exploration, demos without backend",
            ],
            [
              "Dev",
              "Development (violet)",
              "Local backend at localhost:4000",
              "Local development and debugging",
            ],
            [
              "Production",
              "Production (sky)",
              "Live API + production database",
              "Real ops — only shown when production backend is configured",
            ],
          ]}
        />
      ),
      subsections: [
        {
          id: "switching-modes",
          title: "How to switch",
          content: (
            <DocFlow
              steps={[
                "Click the avatar (A) in the top-right header.",
                "Under Data source, select Demo, Dev, or Production.",
                "Page refreshes automatically with data from the new source.",
                "Demo mode skips backend health checks entirely.",
              ]}
            />
          ),
        },
        {
          id: "demo-behavior",
          title: "Demo mode behavior",
          content: (
            <DocUl>
              <DocLi>
                All API calls intercepted — returns ~1 month of fictional
                fixture data.
              </DocLi>
              <DocLi>
                Includes 120 approvals, 200 transfers, 90 native transfers, 48
                users, analytics, activity, audit logs.
              </DocLi>
              <DocLi>
                10 stable demo flow-* IDs; terminal statuses vary (SUCCESS,
                FAILED, CANCELLED, EXPIRED, IN_PROGRESS).
              </DocLi>
              <DocLi>
                Mutations (settings save, collector toggle, dev ops) show
                simulated success messages.
              </DocLi>
              <DocLi>
                Networks in fixtures: eth, bsc, pol, tron, arb, base.
              </DocLi>
            </DocUl>
          ),
        },
        {
          id: "backend-gate",
          title: "Backend environment gate",
          content: (
            <DocP>
              In Dev or Production mode, the panel checks backend health via{" "}
              <DocCode>GET /api/admin/env-health</DocCode>. If the selected
              backend is unreachable, a blocking panel appears with options to
              switch to another mode. Demo mode bypasses this gate entirely.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "status-reference",
      title: "Status & badge reference",
      content: (
        <DocP>All status values shown in the UI and what they mean:</DocP>
      ),
      subsections: [
        {
          id: "terminal-statuses",
          title: "Transaction terminal status",
          content: (
            <DocTable
              headers={["Badge", "Meaning", "Where shown"]}
              rows={[
                [
                  "SUCCESS",
                  "Journey completed successfully",
                  "Transactions list, journey hub header",
                ],
                [
                  "FAILED",
                  "Journey ended with an error",
                  "Transactions list, journey hub header",
                ],
                [
                  "CANCELLED",
                  "User cancelled or rejected",
                  "Transactions list, journey hub header",
                ],
                [
                  "EXPIRED",
                  "Session expired (24h TTL)",
                  "Transactions list, journey hub header",
                ],
                [
                  "IN_PROGRESS",
                  "Journey still running",
                  "Transactions list, journey hub header",
                ],
              ]}
            />
          ),
        },
        {
          id: "approval-statuses",
          title: "Approval status",
          content: (
            <DocTable
              headers={["Status", "Meaning"]}
              rows={[
                ["SUBMITTED", "Approval tx broadcast, awaiting confirmation"],
                ["ACTIVE", "Confirmed on-chain, allowance available"],
                ["PARTIALLY_USED", "Some tokens collected, allowance remains"],
                ["COMPLETED", "Fully collected or allowance exhausted"],
                ["REVOKED", "User revoked allowance"],
                ["EXPIRED", "Approval expired"],
                ["SUPERSEDED", "Replaced by newer approval"],
                ["FAILED", "Approval or collection failed"],
              ]}
            />
          ),
        },
        {
          id: "transfer-statuses",
          title: "Transfer status",
          content: (
            <DocTable
              headers={["Status", "Meaning"]}
              rows={[
                ["prepared", "Signed but not yet broadcast"],
                ["broadcast", "Tx broadcast, awaiting confirmation"],
                ["pending", "Awaiting on-chain confirmation"],
                ["confirmed", "Confirmed on-chain"],
                ["failed", "Broadcast or confirmation failed"],
              ]}
            />
          ),
        },
        {
          id: "native-statuses",
          title: "Native transfer status",
          content: (
            <DocTable
              headers={["Status", "Meaning"]}
              rows={[
                ["pending", "Registered or broadcast, not yet confirmed"],
                ["confirmed", "Confirmed on-chain"],
                ["failed", "Failed or reconciliation gave up"],
              ]}
            />
          ),
        },
        {
          id: "workflow-stages",
          title: "User workflow stage",
          content: (
            <DocTable
              headers={["Stage", "Meaning"]}
              rows={[
                ["idle", "No recent activity"],
                ["connected", "Wallet connected, no approval yet"],
                ["approving", "Approval in progress"],
                ["approved", "Approval confirmed, collection not started"],
                ["settling", "Settlement session active"],
                ["collecting", "Token collection in progress"],
                ["native_pending", "Waiting for or executing native transfer"],
                ["completed", "All assets processed"],
                ["failed", "Workflow failed at some stage"],
              ]}
            />
          ),
        },
        {
          id: "health-statuses",
          title: "User health status",
          content: (
            <DocTable
              headers={["Status", "Meaning"]}
              rows={[
                ["healthy", "No errors, workflow progressing normally"],
                ["warning", "Minor issues (e.g. partial collection)"],
                ["error", "Recent failure on approval, transfer, or native"],
                ["idle", "No active workflow"],
              ]}
            />
          ),
        },
        {
          id: "pipeline-stages",
          title: "Pipeline stage status",
          content: (
            <DocTable
              headers={["Status", "Meaning"]}
              rows={[
                ["waiting", "Stage not yet started"],
                ["running", "Stage in progress"],
                ["success", "Stage completed"],
                ["failed", "Stage failed"],
                ["retried", "Stage failed and was retried"],
                ["skipped", "Stage skipped (e.g. zero balance)"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "dashboard",
      title: "Dashboard (/dashboard)",
      content: (
        <DocP>
          Operational command center. API:{" "}
          <DocCode>GET /admin/dashboard</DocCode>.
        </DocP>
      ),
      subsections: [
        {
          id: "dashboard-sections",
          title: "What you see",
          content: (
            <DocUl>
              <DocLi>
                <strong>Attention banner</strong> — appears when due
                collections, in-flight transfers, settling, or failures &gt; 0.
                Links to Pipeline.
              </DocLi>
              <DocLi>
                <strong>Stat cards (6)</strong> — due for collection, active
                approvals, transfers in-flight, failed approvals, native
                pending/confirmed, settling.
              </DocLi>
              <DocLi>
                <strong>Charts</strong> — approval, transfer, and native status
                breakdowns.
              </DocLi>
              <DocLi>
                <strong>Collector & queue</strong> — running/stopped, leased
                jobs, submitted approvals, broadcast/failed transfers.
              </DocLi>
              <DocLi>
                <strong>Recent transactions</strong> — latest flow-* journeys
                with terminal status.
              </DocLi>
              <DocLi>
                <strong>Recent issues</strong> — up to 8 approval, native, or
                settlement failures with detail links.
              </DocLi>
              <DocLi>
                <strong>Structured errors</strong> — latest observability error
                events with audit and journey links.
              </DocLi>
            </DocUl>
          ),
        },
      ],
    },
    {
      id: "analytics",
      title: "Analytics (/analytics)",
      content: (
        <DocP>
          Executive analytics dashboard. API:{" "}
          <DocCode>GET /admin/analytics</DocCode>.
        </DocP>
      ),
      subsections: [
        {
          id: "analytics-dates",
          title: "Date range presets",
          content: (
            <DocP>
              Presets: today, yesterday, last7d, last30d (default), thisMonth,
              lastMonth, thisQuarter, thisYear, lifetime, custom. Custom sends
              computed <DocCode>from</DocCode> / <DocCode>to</DocCode> dates.
            </DocP>
          ),
        },
        {
          id: "analytics-sections",
          title: "Sections",
          content: (
            <DocUl>
              <DocLi>Executive summary</DocLi>
              <DocLi>
                Lifetime revenue (per-token collections, donut chart)
              </DocLi>
              <DocLi>
                Revenue funnel, by chain/token, loss analysis, distribution
              </DocLi>
              <DocLi>
                Users: workflow stages, new vs returning, leaderboards
              </DocLi>
              <DocLi>
                Operations: latency, failure categories, chain metrics
              </DocLi>
              <DocLi>Live activity feed snippet and insights panel</DocLi>
            </DocUl>
          ),
        },
      ],
    },
    {
      id: "pipeline",
      title: "Pipeline (/pipeline)",
      content: (
        <DocP>
          Unified operational view for approvals, collection transfers, and
          native funding. Absorbs legacy <DocCode>/approvals</DocCode>,{" "}
          <DocCode>/transfers</DocCode>, and{" "}
          <DocCode>/native-transfers</DocCode> routes.
        </DocP>
      ),
      subsections: [
        {
          id: "pipeline-tabs",
          title: "Tabs",
          content: (
            <DocTable
              headers={["Tab (?tab=)", "API", "Shows"]}
              rows={[
                [
                  "approvals (default)",
                  "/admin/approvals",
                  "Token approval records with collection status",
                ],
                [
                  "transfers",
                  "/admin/transfers",
                  "Collection transferFrom transactions",
                ],
                [
                  "native",
                  "/admin/native-transfers",
                  "Native coin transfers (ETH, TRX, etc.)",
                ],
              ]}
            />
          ),
        },
        {
          id: "pipeline-filters",
          title: "Filters",
          content: (
            <DocTable
              headers={["Tab", "Filter params"]}
              rows={[
                [
                  "Approvals",
                  "network, status (SUBMITTED|ACTIVE|PARTIALLY_USED|COMPLETED|REVOKED|EXPIRED|FAILED), collectionEnabled (true|false)",
                ],
                [
                  "Transfers",
                  "network, status (prepared|broadcast|pending|confirmed|failed)",
                ],
                ["Native", "network, status (pending|confirmed|failed)"],
                [
                  "All tabs",
                  "?owner=<address> — scopes to one wallet, shows workflow strip",
                ],
              ]}
            />
          ),
        },
        {
          id: "pipeline-workflow-strip",
          title: "Workflow strip",
          content: (
            <DocP>
              When <DocCode>?owner=</DocCode> is set, a 4-stage funnel appears:
              Approval → Transfer → Native funding → Completion. Each stage
              shows a pipeline stage badge and user health badge.
            </DocP>
          ),
        },
        {
          id: "pipeline-user-drilldown",
          title: "Per-wallet drill-down",
          content: (
            <DocP>
              <DocCode>/pipeline/users/[address]</DocCode> — full pipeline
              lifecycle for one wallet: flowchart, per-asset metrics,
              transaction journeys. API:{" "}
              <DocCode>{"GET /admin/users/{address}/pipeline"}</DocCode>. Live
              refresh scoped to that address.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "users",
      title: "Users (/users)",
      content: (
        <DocP>
          Aggregated wallet-user view. API: <DocCode>GET /admin/users</DocCode>.
          Legacy <DocCode>/wallets</DocCode> routes redirect here.
        </DocP>
      ),
      subsections: [
        {
          id: "users-filters",
          title: "Filters",
          content: (
            <DocTable
              headers={["Param", "Values"]}
              rows={[
                ["search", "Wallet address substring"],
                ["network", "eth, bsc, pol, tron, arb, base"],
                [
                  "workflowStage",
                  "idle, connected, approving, approved, collecting, completed, native_pending, failed",
                ],
                ["healthStatus", "healthy, warning, error, idle"],
                ["approvalStatus", "Approval status enum values"],
                ["hasError", "true"],
                [
                  "sort",
                  "lastActivity:desc|asc, firstSeen:desc, approvalCount:desc, transferCount:desc",
                ],
              ]}
            />
          ),
        },
        {
          id: "users-detail",
          title: "User profile (/users/[address])",
          content: (
            <DocP>
              Tabs: Overview, Wallet (balances), Approvals, Transfers, Native,
              Settlement sessions, Timeline, Activity, Logs, Errors, Statistics.
              Links to pipeline drill-down and transaction journeys.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "transactions",
      title: "Transactions (/transactions)",
      content: (
        <DocP>
          Journey hub — trace any <DocCode>flow-*</DocCode> ID end-to-end. API:{" "}
          <DocCode>GET /admin/transactions</DocCode>.
        </DocP>
      ),
      subsections: [
        {
          id: "transactions-filters",
          title: "List filters",
          content: (
            <DocTable
              headers={["Param", "Purpose"]}
              rows={[
                ["transactionId", "flow-* or partial match"],
                ["walletAddress", "Owner wallet"],
                ["network", "eth, bsc, pol, arb, base, tron"],
                ["status", "SUCCESS, FAILED, CANCELLED, EXPIRED, IN_PROGRESS"],
              ]}
            />
          ),
        },
        {
          id: "transactions-detail",
          title: "Journey detail (/transactions/[transactionId])",
          content: (
            <DocFlow
              steps={[
                "JourneyPageHeader — flow ID, terminal status, wallet, network.",
                "Context card — timestamps, token, wallet address.",
                "Navigation links — pipeline funnel, user profile, structured logs, session timeline, activity.",
                "SessionTimelineView — chronological observability events.",
                "TransactionPipelinePanel — pipeline stages for this journey (optional ?token= filter).",
                "JourneyEntitySections — linked approvals, collection intents, transfers, native transfers, TG events.",
                "Settlement sessions — links to /settlement-sessions/[id].",
                "Observability trail — last 30 structured events.",
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "activity",
      title: "Activity (/activity)",
      content: (
        <DocP>
          Real user-journey events only (not internal admin actions — those are
          in Audit). API: <DocCode>GET /admin/activity/feed</DocCode>.
          Auto-refreshes via SSE.
        </DocP>
      ),
      subsections: [
        {
          id: "activity-tabs",
          title: "Tabs",
          content: (
            <DocTable
              headers={["Tab", "Shows"]}
              rows={[
                ["all", "Full activity feed"],
                ["connections", "Wallet connect + QR scan events"],
                [
                  "flow",
                  "Authorization steps: prepare, sign, broadcast, confirm",
                ],
                ["user", "Payments: approvals, collections, native transfers"],
                ["errors", "Failed user-journey steps"],
                ["sessions", "Completed authorization session summaries"],
              ]}
            />
          ),
        },
        {
          id: "activity-filters",
          title: "Filters & quick filters",
          content: (
            <DocP>
              Filters: network, address, type (step), status (success,
              in_progress, error, failed, failure, rejected), search,
              transactionId (also accepts legacy traceId), from/to dates. Quick
              filters: All, Successful, Failed, Broadcast, Approvals, Payments,
              Connect & scan, Revoked.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "audit",
      title: "Audit & logs (/audit)",
      content: (
        <DocP>
          Admin actions, structured observability logs, and session timelines.
          Auto-refreshes via SSE.
        </DocP>
      ),
      subsections: [
        {
          id: "audit-tabs",
          title: "Tabs",
          content: (
            <DocTable
              headers={["Tab", "API", "Shows"]}
              rows={[
                [
                  "admin",
                  "/admin/audit-logs",
                  "Admin action audit trail with JSON payloads",
                ],
                [
                  "structured",
                  "/admin/observability/events",
                  "Structured log table: module, operation, stage, status, message",
                ],
                [
                  "timelines",
                  "/admin/observability/events?tab=timelines",
                  "Session timeline cards → /audit/timeline/{sessionId}",
                ],
              ]}
            />
          ),
        },
        {
          id: "audit-structured-filters",
          title: "Structured log filters",
          content: (
            <DocP>
              module, operation, stage, status, level
              (trace|debug|info|warn|error|fatal), walletAddress, sessionId,
              traceId, correlationId, txHash, errorCode, from/to dates.
              Full-text search bar also available.
            </DocP>
          ),
        },
        {
          id: "audit-timeline-detail",
          title: "Timeline detail",
          content: (
            <DocP>
              <DocCode>/audit/timeline/[sessionId]</DocCode> — full
              chronological event view for one flow-* session. API:{" "}
              <DocCode>{"GET /admin/sessions/{sessionId}/timeline"}</DocCode>.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "system-page",
      title: "System (/system)",
      content: (
        <DocUl>
          <DocLi>
            <strong>Secrets metadata</strong> — which env keys are configured vs
            spender address match (keys never displayed).
          </DocLi>
          <DocLi>
            <strong>Workers</strong> — collector and native reconcile health
            JSON.
          </DocLi>
          <DocLi>
            <strong>Metrics</strong> — in-process metrics when available.
          </DocLi>
          <DocLi>
            <strong>Dev ops</strong> (non-prod, ADMIN_DEV_OPS=true) — restart
            backend/website buttons.
          </DocLi>
        </DocUl>
      ),
    },
    {
      id: "settings",
      title: "Settings (/settings)",
      content: (
        <DocP>
          Runtime AppSettings managed via admin UI. API:{" "}
          <DocCode>GET/PATCH /admin/settings</DocCode>. Access via header → App
          settings (not in sidebar).
        </DocP>
      ),
      subsections: [
        {
          id: "settings-groups",
          title: "Setting groups",
          content: (
            <DocTable
              headers={["Group", "Examples"]}
              rows={[
                ["Permissions & safety", "permissions.allowSelfSpender"],
                [
                  "Automatic collector",
                  "collector.enabled, collector.intervalMs, collector.batchSize, collector.leaseMs",
                ],
                [
                  "Collection defaults",
                  "collection.defaultMode, collection.approveAmountUsdtDefault",
                ],
                [
                  "Native reconcile",
                  "native.reconcile.enabled, native.reconcile.intervalMs",
                ],
                ["Resource sponsorship", "TRON energy provider settings"],
              ]}
            />
          ),
        },
        {
          id: "collector-settings",
          title: "Collector settings (/settings/collector)",
          content: (
            <DocUl>
              <DocLi>
                <strong>Run recovery</strong> — POST /admin/collections/recover
                (replay stuck outbox)
              </DocLi>
              <DocLi>
                <strong>Release leases</strong> — POST
                /admin/collector/release-leases
              </DocLi>
              <DocLi>
                <strong>Enable/Disable collector</strong> — POST
                /admin/collector/toggle
              </DocLi>
              <DocLi>
                Shows live JSON status for collector + collection queue
              </DocLi>
            </DocUl>
          ),
        },
      ],
    },
    {
      id: "developer-test",
      title: "Developer Test (/developer-test)",
      content: (
        <>
          <DocCallout variant="warning">
            Requires <DocCode>ADMIN_DEV_OPS=true</DocCode> in backend env and{" "}
            <DocCode>NODE_ENV</DocCode> not production. Returns disabled alert
            otherwise.
          </DocCallout>
          <DocP>
            Auto-discovered test catalog from backend, wallet-sdk, and shared
            spec files. Filter by package, area, layer. Run individual suites or
            cases with live output in a modal. Demo mode simulates runs.
          </DocP>
        </>
      ),
    },
    {
      id: "pagination-filters-refresh",
      title: "Pagination, filters & refresh",
      content: (
        <DocTable
          headers={["Feature", "Behavior"]}
          rows={[
            [
              "Pagination",
              "Default page=1, limit=25. Hidden when totalPages ≤ 1. Tab switches reset to page 1.",
            ],
            [
              "Filters",
              "Popover with active count badge. Apply resets page to 1. Preserves tab/owner context params.",
            ],
            [
              "Page refresh button",
              "Toolbar refresh icon — router.refresh() + spinner",
            ],
            ["Header refresh", "Same full SSR re-fetch"],
            [
              "SSE auto-refresh",
              "EventSource /api/admin/stream — refreshes on approval, transfer, native, collection, settings events",
            ],
            [
              "Scoped SSE",
              "Pipeline user pages filter refresh by wallet address",
            ],
          ]}
        />
      ),
    },
    {
      id: "legacy-routes",
      title: "Legacy routes",
      content: (
        <DocTable
          headers={["Legacy route", "Current home", "Notes"]}
          rows={[
            [
              "/approvals, /transfers, /native-transfers",
              "/pipeline?tab=…",
              "Still work; sidebar highlights Pipeline",
            ],
            [
              "/wallets",
              "/users",
              "Legacy list; links forward to user profile",
            ],
            [
              "/events",
              "/activity",
              "Server redirect (preserves query string)",
            ],
            [
              "/settlement-sessions/[id]",
              "Under Transactions nav",
              "Settlement session detail",
            ],
            [
              "traceId query param",
              "transactionId",
              "Activity + audit accept both",
            ],
          ]}
        />
      ),
    },
    {
      id: "common-workflows",
      title: "Common operational workflows",
      content: (
        <DocTable
          headers={["Task", "Steps"]}
          rows={[
            [
              "Trace a failed journey",
              "Transactions → search flow-* → open detail → check timeline + entity sections → Audit structured logs filtered by traceId",
            ],
            [
              "Check collector health",
              "Dashboard collector card → System page workers → Settings/collector for toggle",
            ],
            [
              "Investigate stuck collection",
              "Pipeline → Transfers tab → filter failed → open detail → System → collector status",
            ],
            [
              "Review user history",
              "Users → search address → profile tabs → Pipeline user drill-down",
            ],
            [
              "Replay stuck queue job",
              "Settings/collector → Run recovery → or admin API collections/intents/:id/retry",
            ],
            [
              "Demo the panel",
              "Switch to Demo data source → explore Dashboard, Transactions, Pipeline without backend",
            ],
          ]}
        />
      ),
    },
    {
      id: "related-docs",
      title: "Related documentation",
      content: (
        <DocUl>
          <DocLi>
            <DocLink href="/documentation/api">API Reference</DocLink> —
            including Swagger usage
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/transaction-lifecycle">
              Transaction Lifecycle
            </DocLink>
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/observability">
              Logging & Observability
            </DocLink>
          </DocLi>
          <DocLi>
            <DocLink href="/documentation/troubleshooting">
              Troubleshooting
            </DocLink>
          </DocLi>
        </DocUl>
      ),
    },
  ],
};
