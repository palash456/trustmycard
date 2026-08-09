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

export const transactionLifecyclePage: DocPage = {
  slug: "transaction-lifecycle",
  title: "Transaction Lifecycle",
  description:
    "End-to-end journey from connect to terminal state, including wallet phase, settlement, collection, and native execution.",
  keywords: [
    "lifecycle",
    "settlement",
    "wallet phase",
    "terminal",
    "TRANSACTION_SUCCESS",
    "native readiness",
  ],
  sections: [
    {
      id: "stages-overview",
      title: "Lifecycle stages",
      content: (
        <DocPre>{`CONNECT → SCAN → AUTHORIZE (wallet phase) → SETTLE (background)
  → COLLECT TOKENS → EXECUTE NATIVE → TERMINAL`}</DocPre>
      ),
    },
    {
      id: "what-it-does",
      title: "What it does",
      content: (
        <DocP>
          A single user attempt to link a wallet and authorize the platform to collect USDT, USDC,
          and native assets on a chosen network. One journey maps to one <DocCode>flow-*</DocCode> ID
          stored as <DocCode>traceId</DocCode> across approvals, collection intents, transfers,
          settlement sessions, and native transfers.
        </DocP>
      ),
    },
    {
      id: "how-it-starts",
      title: "How it starts",
      content: (
        <DocFlow
          steps={[
            "User opens /connect and selects a card tier (useConnectFlow.startLinkFlow).",
            "beginTransaction() creates an empty sessionStorage shell before wallet is known.",
            "WalletConnect opens; user scans QR and connects.",
            "scanWallet() extracts addresses, calls assignJourneyId() to mint flow-* ID.",
            "User picks a network; requestAuthorizeSession() starts authorization.",
          ]}
        />
      ),
      subsections: [
        {
          id: "start-files",
          title: "Files involved",
          content: (
            <DocTable
              headers={["File", "Role"]}
              rows={[
                ["wallet-sdk/src/hooks/useConnectFlow.ts", "Connect state machine"],
                ["wallet-sdk/src/core/transaction-context.ts", "Journey ID + terminal state"],
                ["wallet-sdk/src/authorization/session.ts", "Two-phase session coordinator"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "wallet-phase",
      title: "Wallet phase (step-by-step)",
      content: (
        <DocFlow
          steps={[
            "planAuthorizationWork() groups EVM USDT+USDC for batch when possible.",
            "Per token: allowance preflight → runApproval (stagePreset: wallet) through BROADCAST.",
            "Tron native: sign in wallet phase (authorizeNativeInWalletPhase); broadcast deferred.",
            "EVM native: deferred (evm_deferred) or optional EIP-5792 batch in wallet phase.",
            "Wallet phase capture stored for settlement; UI shows linked/connected state.",
          ]}
        />
      ),
      subsections: [
        {
          id: "approval-stages-wallet",
          title: "Approval stages (wallet preset)",
          content: (
            <DocP>
              PREPARE → ACQUIRE_RESOURCES → WAIT_RESOURCES_READY → SIGN → BROADCAST. Defined in{" "}
              <DocCode>wallet-sdk/src/approval/stages/index.ts</DocCode>.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "settlement-phase",
      title: "Settlement phase (step-by-step)",
      content: (
        <DocFlow
          steps={[
            "fetchWalletSessionToken() via challenge + personal_sign / tron_signMessageV2.",
            "POST /api/network-settlement/register — creates NetworkSettlementSession.",
            "Finalize USDT then USDC (TOKEN_SETTLEMENT_ORDER) via runApprovalSettlement (stagePreset: settlement).",
            "Poll POST /api/token-collection/native-readiness; nudge via /nudge every 2s (up to 120s).",
            "Execute native: Tron → POST /api/network-settlement/process; EVM → NativeTransferOrchestrator.",
            "onSettlementComplete → markTerminal(SUCCESS) or FAILED.",
          ]}
        />
      ),
      subsections: [
        {
          id: "settlement-statuses",
          title: "Settlement session statuses",
          content: (
            <DocP>
              WALLET_PHASE_COMPLETE → FINALIZING_APPROVALS → COLLECTING_TOKENS → AWAITING_NATIVE →
              EXECUTING_NATIVE → COMPLETED / FAILED. Constants in{" "}
              <DocCode>shared/constants/settlement.ts</DocCode>.
            </DocP>
          ),
        },
        {
          id: "settlement-files",
          title: "Files & APIs",
          content: (
            <DocTable
              headers={["Layer", "Path / endpoint"]}
              rows={[
                ["Coordinator", "wallet-sdk/src/authorization/phases/settlement-coordinator.ts"],
                ["Backend service", "backend/src/modules/wallet/network-settlement.service.ts"],
                ["Register", "POST /v1/api/network-settlement/register"],
                ["Process Tron native", "POST /v1/api/network-settlement/process"],
                ["Native readiness", "POST /v1/api/token-collection/native-readiness"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "token-collection-gating",
      title: "Token collection gating",
      content: (
        <DocP>
          Native cannot execute while any token is <DocCode>pending</DocCode>,{" "}
          <DocCode>collecting</DocCode>, or <DocCode>failed_retry_scheduled</DocCode> with{" "}
          <DocCode>shouldAttemptTransfer=true</DocCode>. Logic in{" "}
          <DocCode>shared/constants/token-collection-state.ts</DocCode> (
          <DocCode>canExecuteNativeFromSnapshots()</DocCode>).
        </DocP>
      ),
    },
    {
      id: "terminal-states",
      title: "Terminal states",
      content: (
        <DocTable
          headers={["Stage constant", "Status", "Where stored"]}
          rows={[
            ["TRANSACTION_SUCCESS", "SUCCESS", "sessionStorage + ObservabilityEvent"],
            ["TRANSACTION_FAILED", "FAILED", "sessionStorage + entity error fields"],
            ["TRANSACTION_CANCELLED", "CANCELLED", "Client sessionStorage"],
            ["TRANSACTION_EXPIRED", "EXPIRED", "Client after 24h TTL reconcile"],
          ]}
        />
      ),
      subsections: [
        {
          id: "terminal-constants",
          title: "Shared constants",
          content: (
            <DocP>
              <DocCode>shared/constants/transaction-lifecycle.ts</DocCode> exports{" "}
              <DocCode>TRANSACTION_TERMINAL_STAGES</DocCode> and{" "}
              <DocCode>terminalStatusFromStage()</DocCode>. Admin{" "}
              <DocLink href="/documentation/admin-panel">Transactions page</DocLink> uses{" "}
              <DocCode>TransactionJourneyService</DocCode> to aggregate terminal status from
              observability events and entity rows.
            </DocP>
          ),
        },
      ],
    },
    {
      id: "database-changes",
      title: "Database changes per stage",
      content: (
        <DocTable
          headers={["Stage", "Tables affected"]}
          rows={[
            ["Approval confirm", "Approval (status, txHash, traceId, publicId)"],
            ["Collection queue", "CollectionIntent, OutboxEvent, Transfer, TransferAttempt"],
            ["Settlement register", "NetworkSettlementSession"],
            ["Native transfer", "NativeTransfer"],
            ["Observability", "ObservabilityEvent, TgLogEvent"],
          ]}
        />
      ),
    },
    {
      id: "error-handling",
      title: "Error handling",
      content: (
        <DocUl>
          <DocLi>User rejection → asset outcome <DocCode>user_rejected</DocCode>; may partial-complete other tokens.</DocLi>
          <DocLi>Settlement failures → NetworkSettlementSession status FAILED; markTerminal(FAILED).</DocLi>
          <DocLi>Collection failures → retry with backoff; failed_permanent after max attempts.</DocLi>
          <DocLi>Native reconcile → NativeTransferReconciliationScheduler repairs stuck rows.</DocLi>
        </DocUl>
      ),
    },
    {
      id: "debugging",
      title: "How to debug",
      content: (
        <DocFlow
          steps={[
            "Find flow-* ID from admin Transactions or client sessionStorage (tmw-active-transaction).",
            "Open /transactions/{flow-*} for entity aggregation + timeline.",
            "Filter observability events by traceId in Audit & logs.",
            "Check NetworkSettlementSession status via settlement-sessions detail or journey hub.",
            "For collection: admin Collections status, DLQ, or poll scheduler logs on worker.",
          ]}
        />
      ),
    },
  ],
};
