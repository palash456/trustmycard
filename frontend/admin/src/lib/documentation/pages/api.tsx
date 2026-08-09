import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocLi,
  DocP,
  DocPre,
  DocTable,
  DocUl,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const apiPage: DocPage = {
  slug: "api",
  title: "API Reference",
  description: "Wallet API, admin API, auth, observability endpoints, and Swagger interactive docs.",
  keywords: ["endpoints", "rest", "admin api", "wallet api", "v1", "swagger", "openapi"],
  sections: [
    {
      id: "swagger",
      title: "Swagger / OpenAPI docs",
      content: (
        <>
          <DocP>
            The NestJS backend ships interactive API documentation via{" "}
            <DocCode>@nestjs/swagger</DocCode> and <DocCode>swagger-ui-express</DocCode>. It is
            disabled by default in production and must be explicitly enabled.
          </DocP>
          <DocTable
            headers={["Setting", "Value"]}
            rows={[
              ["Env var", "SWAGGER_ENABLED=true"],
              ["URL (local)", "http://localhost:4000/v1/docs"],
              ["URL (production)", "https://api.trustmycard.com/v1/docs (only when enabled)"],
              ["OpenAPI JSON", "http://localhost:4000/v1/docs-json"],
              ["Implementation", "backend/src/main.ts"],
            ]}
          />
        </>
      ),
      subsections: [
        {
          id: "swagger-enable-local",
          title: "Enable locally",
          content: (
            <DocFlow
              steps={[
                "Add SWAGGER_ENABLED=true to env/profiles/development/platform.env (or export in shell).",
                "Restart the backend: cd backend && npm run start:dev.",
                "Open http://localhost:4000/v1/docs in your browser.",
                "Startup log confirms: context.swagger = /v1/docs in structured bootstrap event.",
              ]}
            />
          ),
        },
        {
          id: "swagger-auth",
          title: "Authenticating in Swagger UI",
          content: (
            <>
              <DocP>
                Swagger is configured with an admin API key security scheme named{" "}
                <DocCode>adminApiKey</DocCode>:
              </DocP>
              <DocPre>{`Header: x-admin-api-key
Value: <your ADMIN_API_KEY from platform.env>`}</DocPre>
              <DocFlow
                steps={[
                  "Click Authorize (lock icon) in the top-right of Swagger UI.",
                  "Enter your ADMIN_API_KEY value in the adminApiKey field.",
                  "Click Authorize, then Close.",
                  "All admin endpoints (tagged in admin.controller.ts) will send the key automatically.",
                ]}
              />
              <DocCallout variant="warning">
                Wallet session endpoints require a separate <DocCode>Authorization: Bearer &lt;token&gt;</DocCode>{" "}
                header — obtain via POST /v1/auth/wallet/challenge + verify. Swagger does not
                auto-manage wallet sessions; use curl or the wallet app for those flows.
              </DocCallout>
            </>
          ),
        },
        {
          id: "swagger-documented-controllers",
          title: "What is documented",
          content: (
            <DocTable
              headers={["Controller", "Swagger tags", "Notes"]}
              rows={[
                ["wallet.controller.ts", "Wallet API", "ApiOperation + ApiBody on key endpoints; ApiSecurity for session routes"],
                ["admin.controller.ts", "Admin", "ApiOperation on endpoints; requires adminApiKey"],
                ["settings.controller.ts", "Settings", "Public settings endpoint"],
                ["auth.controller.ts", "—", "Not heavily decorated — use this doc for auth routes"],
              ]}
            />
          ),
        },
        {
          id: "swagger-try-endpoints",
          title: "Trying endpoints",
          content: (
            <DocFlow
              steps={[
                "Enable Swagger locally (SWAGGER_ENABLED=true).",
                "Authorize with ADMIN_API_KEY for admin routes.",
                "Expand any endpoint → Try it out → fill request body → Execute.",
                "Check Response body and Response headers below the form.",
                "For GET /v1/api/settings/public — no auth needed; good smoke test.",
                "For wallet routes — use x-correlation-id header with a flow-* ID for tracing.",
              ]}
            />
          ),
        },
        {
          id: "swagger-production",
          title: "Production policy",
          content: (
            <DocUl>
              <DocLi>
                <DocCode>render-budget.yaml</DocCode> sets <DocCode>SWAGGER_ENABLED=false</DocCode> by default.
              </DocLi>
              <DocLi>Do not enable Swagger on public production API without access controls — it exposes endpoint shapes.</DocLi>
              <DocLi>Safe pattern: enable only in development or staging (<DocCode>TMC_ENV=production-preview</DocCode>).</DocLi>
              <DocLi>Alternative: use admin panel or curl with <DocCode>x-admin-api-key</DocCode> for ops testing.</DocLi>
            </DocUl>
          ),
        },
        {
          id: "swagger-vs-admin",
          title: "Swagger vs Admin Panel",
          content: (
            <DocTable
              headers={["Use Swagger when…", "Use Admin Panel when…"]}
              rows={[
                ["Exploring raw API request/response shapes", "Viewing aggregated journey data"],
                ["Testing a single endpoint with custom body", "Monitoring pipeline, collector, analytics"],
                ["Debugging backend without UI", "Tracing flow-* journeys with entity links"],
                ["Validating a new endpoint during development", "Operational workflows (retry, reconcile, toggle collector)"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "base-url",
      title: "Base URL & auth",
      content: (
        <DocTable
          headers={["Surface", "Base", "Auth"]}
          rows={[
            ["Wallet API", "/v1/api/*", "Wallet session Bearer (protected routes) or open"],
            ["Auth", "/v1/auth/*", "Open"],
            ["Admin API", "/v1/api/admin/*", "x-admin-api-key header"],
            ["Observability", "/v1/client-logs", "Open (202, no throttle)"],
            ["Metrics", "/v1/admin/metrics", "Admin key"],
          ]}
        />
      ),
    },
    {
      id: "wallet-api",
      title: "Wallet API (/v1/api/*)",
      content: (
        <DocTable
          headers={["Method", "Route", "Auth", "Description"]}
          rows={[
            ["GET", "balances", "—", "EVM/TRON balances"],
            ["POST", "approvals/prepare", "—", "Build approve() tx payload"],
            ["POST", "approvals/confirm", "Session", "Persist on-chain approval"],
            ["POST", "approvals/queue-collection", "Session", "Queue from existing allowance"],
            ["GET", "approvals/:id", "Session", "Owner-scoped approval"],
            ["POST", "native-transfers/estimate", "—", "Fee + max sendable"],
            ["POST", "native-transfers/register-pending", "Session", "Register broadcast native tx"],
            ["POST", "native-transfers/confirm", "Session", "Confirm native transfer"],
            ["POST", "network-settlement/register", "Session", "Register wallet-phase completion"],
            ["POST", "network-settlement/process", "Session", "Process deferred Tron native"],
            ["GET", "network-settlement/:id/status", "—", "Poll settlement progress"],
            ["POST", "token-collection/native-readiness", "Session", "Check if native can proceed"],
            ["POST", "token-collection/nudge", "Session", "Retry blocking collection"],
            ["POST", "resources/acquire", "—", "Chain-agnostic resource acquire"],
            ["POST", "tron-broadcast", "—", "Broadcast TRON tx"],
            ["POST", "verify-allowance", "—", "Verify on-chain allowance"],
            ["POST", "tg-log", "—", "Telegram-style client events"],
          ]}
        />
      ),
    },
    {
      id: "auth-api",
      title: "Auth API (/v1/auth/*)",
      content: (
        <DocTable
          headers={["Method", "Route", "Description"]}
          rows={[
            ["POST", "wallet/challenge", "Create signed challenge → WalletSession row"],
            ["POST", "wallet/verify", "Verify signature → sessionToken"],
          ]}
        />
      ),
    },
    {
      id: "admin-api",
      title: "Admin API (/v1/api/admin/*)",
      content: (
        <DocP>All routes require <DocCode>x-admin-api-key</DocCode>. Controller: <DocCode>admin.controller.ts</DocCode>.</DocP>
      ),
      subsections: [
        {
          id: "admin-analytics",
          title: "Analytics & dashboard",
          content: (
            <DocPre>{`GET analytics, analytics/activity, dashboard`}</DocPre>
          ),
        },
        {
          id: "admin-entities",
          title: "Entity lists & detail",
          content: (
            <DocPre>{`GET approvals, approvals/:id (PATCH)
GET transfers, transfers/:id, transfers/:id/retry, transfers/:id/reconcile
GET native-transfers, native-transfers/:id, native-transfers/:id/reconcile
GET wallets, wallets/:address
GET users, users/:address, users/:address/balances, users/:address/pipeline
GET settlement-sessions, settlement-sessions/:id
GET transactions, transactions/:transactionId`}</DocPre>
          ),
        },
        {
          id: "admin-ops",
          title: "Operations & monitoring",
          content: (
            <DocPre>{`GET collections/status, collections/intents, collections/dlq
POST collections/intents/:id/retry, collections/recover
GET activity/feed, activity/feed/:source/:id
GET audit-logs, observability/events
GET sessions/:sessionId/timeline
GET tg-events, tg-events/:id
GET system/status, stream (SSE), metrics
GET/PATCH settings, POST settings/reload
POST collector/toggle, collector/tick, collector/release-leases`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "admin-proxy",
      title: "Admin BFF proxy",
      content: (
        <DocP>
          Admin Next.js proxies via <DocCode>src/app/api/admin/[...path]/route.ts</DocCode> to backend.
          Client code uses <DocCode>adminGetData()</DocCode> from <DocCode>lib/admin-data.ts</DocCode>.
        </DocP>
      ),
    },
  ],
};
