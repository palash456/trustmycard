import {
  DocCode,
  DocFlow,
  DocLi,
  DocP,
  DocPre,
  DocTable,
  DocUl,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const walletFlowsPage: DocPage = {
  slug: "wallet-flows",
  title: "Wallet & Connect Flows",
  description:
    "WalletConnect integration, connect UI state machine, authorization, and BFF API routes.",
  keywords: [
    "walletconnect",
    "connect",
    "useConnectFlow",
    "approval",
    "bff",
    "session",
  ],
  sections: [
    {
      id: "entry-points",
      title: "Entry points",
      content: (
        <DocTable
          headers={["File", "Role"]}
          rows={[
            ["wallet-sdk/src/components/ConnectFlow.tsx", "UI shell"],
            [
              "wallet-sdk/src/hooks/useConnectFlow.ts",
              "State machine (~1200 lines)",
            ],
            ["website/src/app/connect/page.tsx", "Product route at /connect"],
            [
              "wallet-sdk/src/providers/wallet-connect-provider.ts",
              "UniversalProvider singleton",
            ],
          ]}
        />
      ),
    },
    {
      id: "connect-sequence",
      title: "Connect sequence",
      content: (
        <DocFlow
          steps={[
            "Card tier select → ChooseCardModal with tier assets from link-flow-meta.ts.",
            "beginTransaction() — empty sessionStorage shell.",
            "openWalletConnect() — QR after CARD_CONNECTING_MIN_MS delay.",
            "scanWallet() — extract EVM/Tron accounts, assignJourneyId(), fetch /api/balances, postTgLog(scan).",
            "Network pick — user selects one network.",
            "requestAuthorizeSession() → runAuthorizationSession().",
          ]}
        />
      ),
    },
    {
      id: "wallet-session-auth",
      title: "Wallet session authentication",
      content: (
        <DocFlow
          steps={[
            "POST /api/auth/wallet/challenge → { sessionId, challenge }.",
            "User signs via WalletConnect (personal_sign or tron_signMessageV2).",
            "POST /api/auth/wallet/verify → short-lived Bearer token.",
            "Cached in wallet-session-cache.ts (sessionStorage + in-memory).",
            "Required for settlement, native register/confirm, collection nudges.",
          ]}
        />
      ),
      subsections: [
        {
          id: "wallet-session-backend",
          title: "Backend implementation",
          content: (
            <DocP>
              <DocCode>
                backend/src/modules/auth/wallet-session.service.ts
              </DocCode>{" "}
              stores challenges in <DocCode>WalletSession</DocCode> table. TTL
              from <DocCode>WALLET_SESSION_TTL_MS</DocCode> (default 30 min).
              Guard: <DocCode>WalletSessionGuard</DocCode>.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "approval-orchestrator",
      title: "Approval orchestrator",
      content: (
        <DocP>
          <DocCode>wallet-sdk/src/approval/orchestrator.ts</DocCode> runs the
          per-token stage machine. HTTP port:{" "}
          <DocCode>approval/http-api-client.ts</DocCode> implementing{" "}
          <DocCode>ApprovalApiPort</DocCode>: prepare → acquireResources →
          verifyResources → sign/broadcast → confirm → persist → postApproval →
          queueCollection.
        </DocP>
      ),
      subsections: [
        {
          id: "evm-batch",
          title: "EVM batch optimization",
          content: (
            <DocP>
              When 2+ tokens on same EVM network: tries{" "}
              <DocCode>wallet_sendCalls</DocCode> (EIP-5792) → Multicall3 →
              sequential fallback. Implementation:{" "}
              <DocCode>authorization/evm-token-batch.ts</DocCode>.
            </DocP>
          ),
        },
        {
          id: "native-by-chain",
          title: "Native behavior by chain",
          content: (
            <DocTable
              headers={["Chain", "Wallet phase", "Settlement"]}
              rows={[
                [
                  "TRON",
                  "Sign native tx",
                  "Server broadcasts via /network-settlement/process",
                ],
                [
                  "EVM",
                  "Deferred (no popup)",
                  "NativeTransferOrchestrator after tokens idle",
                ],
                [
                  "EVM batch",
                  "Optional in EIP-5792 batch",
                  "Mark complete via native-complete",
                ],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "bff-routes",
      title: "BFF API routes (website)",
      content: (
        <DocPre>{`/api/balances
/api/auth/wallet/challenge, /verify
/api/approvals/prepare, /confirm, /queue-collection
/api/verify-allowance
/api/native-transfers/estimate, /register-pending, /confirm
/api/network-settlement/register, /process, /[id]/status, /native-complete
/api/token-collection/nudge, /native-readiness
/api/client-logs, /tg-log
/api/tron-broadcast, /energy-delegate, /resources/acquire`}</DocPre>
      ),
      subsections: [
        {
          id: "proxy-impl",
          title: "Proxy implementation",
          content: (
            <DocP>
              <DocCode>wallet-sdk/src/server/proxy-backend-api.ts</DocCode>{" "}
              forwards to Nest <DocCode>/v1/api/*</DocCode> and{" "}
              <DocCode>/v1/client-logs</DocCode>. Forwards{" "}
              <DocCode>x-correlation-id</DocCode> and{" "}
              <DocCode>Authorization</DocCode> headers.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "ui-progress",
      title: "UI progress stages",
      content: (
        <DocP>
          <DocCode>LINK_PROGRESS_STAGES</DocCode> in{" "}
          <DocCode>link-flow-meta.ts</DocCode> drives monotonic progress:
          connecting → syncing → verifying → preparing → USDT/USDC/native →
          collecting → complete. Mapped from approval stages, asset type, and
          settlement events.
        </DocP>
      ),
    },
    {
      id: "error-handling",
      title: "Error handling",
      content: (
        <DocUl>
          <DocLi>
            Structured errors in{" "}
            <DocCode>wallet-sdk/src/core/errors.ts</DocCode> with user-facing
            messages.
          </DocLi>
          <DocLi>
            User rejection captured as LogStatus.user_rejection in
            observability.
          </DocLi>
          <DocLi>
            Telegram alerts for scan/approve/native rejection via
            tg-log-client.ts.
          </DocLi>
          <DocLi>
            Terminal state persisted via markTerminal() with 24h sessionStorage
            TTL.
          </DocLi>
        </DocUl>
      ),
    },
    {
      id: "debugging",
      title: "How to debug",
      content: (
        <DocFlow
          steps={[
            "Reproduce on localhost:3000/connect with browser devtools Network tab.",
            "Inspect sessionStorage key tmw-active-transaction for journey ID and terminal state.",
            "Enable wallet-sdk dev flow logs (flow-log-client) if ADMIN_DEV_OPS enabled.",
            "Trace x-correlation-id through BFF proxy to backend logs.",
            "Use admin Audit timeline for sessionId = flow-*.",
          ]}
        />
      ),
    },
  ],
};
