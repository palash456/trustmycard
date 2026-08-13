import {
  DocCode,
  DocFlow,
  DocP,
  DocTable,
  DocUl,
  DocLi,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const troubleshootingPage: DocPage = {
  slug: "troubleshooting",
  title: "Troubleshooting & Debugging",
  description: "Common issues, debug workflows, and known limitations.",
  keywords: ["debug", "troubleshoot", "stuck", "failed", "dlq", "reconcile", "marketing", "connect", "fbclid"],
  sections: [
    {
      id: "debug-workflow",
      title: "General debug workflow",
      content: (
        <DocFlow
          steps={[
            "Identify the flow-* journey ID (admin Transactions, client sessionStorage, or logs).",
            "Open /transactions/{flow-*} for entity aggregation and timeline.",
            "Check NetworkSettlementSession status if settlement-related.",
            "Review observability timeline at /audit/timeline/{flow-*}.",
            "For collection: admin Collections status, DLQ, worker logs.",
            "For native: NativeTransfer status + reconciliation scheduler.",
          ]}
        />
      ),
    },
    {
      id: "stuck-settlement",
      title: "Stuck settlement",
      content: (
        <DocTable
          headers={["Symptom", "Likely cause", "Action"]}
          rows={[
            [
              "COLLECTING_TOKENS forever",
              "Token collection pending/failed",
              "Check Approval collectionEnabled; nudge via API; verify collector running",
            ],
            [
              "AWAITING_NATIVE",
              "Tokens not idle",
              "POST token-collection/native-readiness; check collection states",
            ],
            [
              "EXECUTING_NATIVE stuck",
              "Native broadcast/confirm failed",
              "Check NativeTransfer row; run reconciliation scheduler",
            ],
            [
              "FAILED status",
              "Any phase error",
              "Check ObservabilityEvent failure entries; entity lastError fields",
            ],
          ]}
        />
      ),
    },
    {
      id: "collection-issues",
      title: "Collection issues",
      content: (
        <DocTable
          headers={["Symptom", "Action"]}
          rows={[
            [
              "Intent stuck in CREATED/QUEUED",
              "Verify COLLECTION_DISPATCH_MODE; check OutboxEvent PENDING rows",
            ],
            [
              "DLQ entries",
              "Admin collections/dlq → inspect → retry via collections/intents/:id/retry",
            ],
            [
              "Collector not running",
              "Admin System → collector status; verify COLLECTOR_ENABLED and worker process",
            ],
            [
              "Signing errors",
              "Verify signing keys on worker only; COLLECTION_SIGNING_ENABLED=true on worker",
            ],
          ]}
        />
      ),
    },
    {
      id: "marketing-connect",
      title: "Marketing /connect access",
      content: (
        <DocTable
          headers={["Symptom", "Action"]}
          rows={[
            [
              "502 fetch failed / wallet broken",
              "api.mytrustvisa.cards DNS missing — add CNAME api → Render tmc-backend; set BACKEND_API_URL + APP_ORIGIN; redeploy both",
            ],
            [
              "Redirect to localhost:10000/connect",
              "Set NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards on tmc-wallet-app and redeploy",
            ],
            [
              "Duplicate MARKETING_SESSION_TTL_MINUTES on Render",
              "Keep one row only — 1440 for production ads, 15 optional for dev",
            ],
            [
              "Ad click stays on decoy /",
              "Confirm ad URL is mytrustvisa.cards/ (not /connect); check fbclid in URL; verify MARKETING_SESSION_SECRET on Render",
            ],
            [
              "Manual /connect redirects to /",
              "Expected — access requires marketing session from ad click or test URL",
            ],
            [
              "/api/marketing-test returns 404",
              "Set MARKETING_TEST_SECRET on tmc-wallet-app and redeploy",
            ],
            [
              "WalletConnect origin error on new domain",
              "Add https://mytrustvisa.cards in WalletConnect Cloud; redeploy after NEXT_PUBLIC_APP_URL change",
            ],
            [
              "CORS errors from wallet app",
              "Set APP_ORIGIN=https://mytrustvisa.cards on tmc-backend",
            ],
            [
              "Meta Pixel no events",
              "Pixel fires on /connect only — complete ad click flow or use test URL first",
            ],
          ]}
        />
      ),
    },
    {
      id: "wallet-connect",
      title: "Wallet connect issues",
      content: (
        <DocTable
          headers={["Symptom", "Action"]}
          rows={[
            [
              "QR not appearing",
              "Check WalletConnect project ID env; CARD_CONNECTING_MIN_MS delay",
            ],
            [
              "Session expired",
              "Wallet session TTL exceeded; re-authenticate via challenge/verify",
            ],
            [
              "Wrong network",
              "User must select correct network; EVM chain switch handled in orchestrator",
            ],
            [
              "User rejected",
              "Normal outcome; check terminalStatus CANCELLED/FAILED",
            ],
          ]}
        />
      ),
    },
    {
      id: "admin-issues",
      title: "Admin panel issues",
      content: (
        <DocTable
          headers={["Symptom", "Action"]}
          rows={[
            [
              "Demo data showing",
              "Check AdminDataModeBadge — toggle off demo mode",
            ],
            [
              "Backend unreachable",
              "BackendStatusProvider shows status; verify localhost:4000 or prod API URL",
            ],
            [
              "Empty transactions",
              "Verify traceId populated on recent approvals; check log env matches backend",
            ],
          ]}
        />
      ),
    },
    {
      id: "known-limitations",
      title: "Known limitations",
      content: (
        <DocUl>
          <DocLi>
            Legacy opaque flow IDs still in demo fixtures and old records.
          </DocLi>
          <DocLi>
            Poll mode is default; queue mode requires Redis + worker setup.
          </DocLi>
          <DocLi>
            EVM native deferred — user sees no native popup in wallet phase on
            EVM.
          </DocLi>
          <DocLi>
            Admin has no automated test suite — rely on backend/wallet-sdk tests
            + manual QA.
          </DocLi>
          <DocLi>
            Competitive analysis docs (Jul 2026) predate semantic IDs and
            transaction journey.
          </DocLi>
        </DocUl>
      ),
    },
    {
      id: "dev-tools",
      title: "Developer tools",
      content: (
        <DocP>
          Admin <DocCode>/developer-test</DocCode> panel (non-prod): integration
          test triggers. Backend <DocCode>GET /api/approvals/debug</DocCode>{" "}
          (admin key): debug snapshot. Swagger at <DocCode>/v1/docs</DocCode>{" "}
          when enabled. Local DB reset:{" "}
          <DocCode>backend/scripts/delete-local-db.ts</DocCode>.
        </DocP>
      ),
    },
  ],
};
