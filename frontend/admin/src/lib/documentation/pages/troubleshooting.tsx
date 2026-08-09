import {
  DocCallout,
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
  keywords: ["debug", "troubleshoot", "stuck", "failed", "dlq", "reconcile"],
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
