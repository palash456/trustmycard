import {
  TRANSACTION_TERMINAL_STAGES,
  terminalStatusFromStage,
} from "../constants/transaction-lifecycle";
import type { LogStatus } from "./schemas";

export type ObservabilityDisplayStatus =
  "completed" | "in_progress" | "failed" | "cancelled" | "revoked";

const ONGOING_STEP_PATTERNS = [
  /^SETTLEMENT PROGRESS$/i,
  /^STAGE_START$/i,
  /^CONFIRMATION_POLL$/i,
  /^ALLOWANCE_VERIFY_POLL$/i,
  /^CHAIN_DIAGNOSTIC$/i,
];

const COMPLETED_STEP_PATTERNS = [
  /SUCCESS|COMPLETE|CONNECTED/i,
  /^SCAN STARTED$/i,
  /^CONNECT STARTED$/i,
  /^QR DISPLAYED$/i,
  /^QR HELD/i,
  /^SESSION DELETED$/i,
  /^APPROVAL SESSION STARTED$/i,
  /^TRON SPONSOR HEALTH OK$/i,
  /^BALANCES REFRESHED/i,
  /^BALANCE SNAPSHOT FRESH/i,
  /^BALANCE REFRESH FAILED — USING CONNECT SNAPSHOT$/i,
  /STAGE_END$/i,
  /^APPROVAL_ORCHESTRATION_SUCCESS$/i,
  /^LIFECYCLE_CHECKPOINT$/i,
];

const FAILURE_STEP_PATTERNS = [/FAILED|ERROR|REJECTED/i];

const CANCELLED_STEP_PATTERNS = [
  new RegExp(TRANSACTION_TERMINAL_STAGES.CANCELLED, "i"),
  /CANCELLED/i,
];

function walletPhaseLogStatus(detail: Record<string, unknown>): LogStatus {
  const authorized = Number(detail.authorizedCount ?? 0);
  const failed = Number(detail.failedCount ?? 0);
  const rejected = Number(detail.rejectedCount ?? 0);
  if (failed > 0 && authorized === 0) return "failure";
  if (failed > 0 || rejected > 0) return "partial_success";
  return "success";
}

function isUserDenied(
  step: string,
  detail: Record<string, unknown> = {},
): boolean {
  if (
    detail.userRejected === true ||
    detail.failureKind === "USER_REJECTION" ||
    /USER_REJECTED|USER_REJECTION|PERMISSION_DENIED/i.test(step)
  ) {
    return true;
  }

  if (step === "SETTLEMENT COMPLETE" && detail.ok === false) {
    const error = detail.error ?? detail.message;
    if (
      typeof error === "string" &&
      /rejected|denied|cancel|abort|permission denied/i.test(error)
    ) {
      return true;
    }

    const items = detail.items as Array<{ outcome?: string }> | undefined;
    if (items?.some((item) => item.outcome === "user_rejected")) {
      const hasSuccessfulItem = items.some((item) =>
        ["authorized", "collected", "pending"].includes(String(item.outcome)),
      );
      if (!hasSuccessfulItem) return true;
    }
  }

  return false;
}

function isSoftFailure(step: string): boolean {
  return (
    (/NATIVE|native_transfer/i.test(step) &&
      !/SESSION FAILED/i.test(step) &&
      !/EIP5792_BATCH_NATIVE_UNKNOWN|EVM_BATCH_NATIVE_RECONCILE/i.test(step)) ||
    /EIP5792_BATCH_FAILED|EIP5792_BATCH_UNSUPPORTED/i.test(step) ||
    /USING CONNECT SNAPSHOT/i.test(step)
  );
}

function isTerminalHandledFailure(step: string): boolean {
  return (
    step === "SETTLEMENT_FAILED" ||
    step === TRANSACTION_TERMINAL_STAGES.FAILED ||
    step === TRANSACTION_TERMINAL_STAGES.CANCELLED ||
    step === TRANSACTION_TERMINAL_STAGES.EXPIRED
  );
}

function matchesAny(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/** Resolve persisted log status for connect-flow steps at emission time. */
export function resolveConnectStepLogStatus(
  step: string,
  detail: Record<string, unknown> = {},
): LogStatus {
  if (isUserDenied(step, detail)) return "user_rejection";

  const terminal = terminalStatusFromStage(step);
  if (terminal === "CANCELLED") return "user_rejection";
  if (terminal === "SUCCESS") return "success";
  if (terminal === "FAILED" || terminal === "EXPIRED") return "failure";

  if (step === "SETTLEMENT COMPLETE") {
    if (detail.ok !== false) return "success";
    if (isUserDenied(step, detail)) return "user_rejection";
    return "failure";
  }

  if (step === "SETTLEMENT PROGRESS") {
    const progressStage = String(detail.stage ?? "").toLowerCase();
    if (progressStage === "completed") return "success";
    if (progressStage === "failed") return "failure";
    return "in_progress";
  }

  if (step.includes("WALLET PHASE COMPLETE")) {
    return walletPhaseLogStatus(detail);
  }

  const hardFailure =
    matchesAny(FAILURE_STEP_PATTERNS, step) &&
    !isSoftFailure(step) &&
    !isTerminalHandledFailure(step);

  if (hardFailure) return "failure";
  if (matchesAny(ONGOING_STEP_PATTERNS, step)) return "in_progress";
  if (matchesAny(COMPLETED_STEP_PATTERNS, step)) return "success";

  return "success";
}

/** Resolve persisted log status for approval-module events at emission time. */
export function resolveApprovalEventLogStatus(
  event: string,
  level: "info" | "warn" | "error",
  detail: Record<string, unknown> = {},
): LogStatus {
  if (isUserDenied(event, detail)) return "user_rejection";
  if (level === "error") return "failure";

  if (/ORCHESTRATION_FAILED|AUTHORIZATION SESSION FAILED/i.test(event)) {
    return "failure";
  }
  if (/STAGE_RETRY|SOFT_FAIL|CHAIN_DIAGNOSTIC_SOFT_FAIL/i.test(event)) {
    return "partial_success";
  }
  if (/ORCHESTRATION_SUCCESS|STAGE_END|_SUCCESS|_COMPLETE|_OK$/i.test(event)) {
    return "success";
  }
  if (/STAGE_START|CONFIRMATION_POLL|ALLOWANCE_VERIFY_POLL/i.test(event)) {
    return "in_progress";
  }

  return level === "warn" ? "partial_success" : "success";
}

function reEvaluateStoredLogStatus(input: {
  status: string;
  stage?: string | null;
  operation?: string | null;
  module?: string | null;
  context?: Record<string, unknown>;
}): LogStatus | null {
  const stage = input.stage?.trim() ?? "";
  const operation = input.operation?.trim() ?? "";
  const step = stage || operation.replace(/_/g, " ");

  if (!step) return null;

  if (input.module === "settlement") {
    if (stage === "COMPLETED") return "success";
    if (stage === "FAILED") return "failure";
    if (
      stage &&
      !["COMPLETED", "FAILED"].includes(stage) &&
      input.status === "in_progress"
    ) {
      return "in_progress";
    }
  }

  if (step === "SETTLEMENT PROGRESS" || operation === "settlement_progress") {
    const progressStage = String(input.context?.stage ?? "").toLowerCase();
    if (progressStage === "completed") return "success";
    if (progressStage === "failed") return "failure";
    return "in_progress";
  }

  if (matchesAny(CANCELLED_STEP_PATTERNS, step)) return "user_rejection";
  if (terminalStatusFromStage(step) === "SUCCESS") return "success";
  if (
    terminalStatusFromStage(step) === "FAILED" ||
    terminalStatusFromStage(step) === "EXPIRED"
  ) {
    return "failure";
  }
  if (matchesAny(ONGOING_STEP_PATTERNS, step)) return "in_progress";
  if (matchesAny(COMPLETED_STEP_PATTERNS, step)) return "success";
  if (matchesAny(FAILURE_STEP_PATTERNS, step) && !isSoftFailure(step)) {
    return "failure";
  }

  return null;
}

/** Map stored log status + event metadata to admin-friendly display status. */
export function resolveObservabilityDisplayStatus(input: {
  status: string;
  stage?: string | null;
  operation?: string | null;
  module?: string | null;
  level?: string | null;
  context?: Record<string, unknown>;
}): ObservabilityDisplayStatus {
  const stored = input.status?.trim().toLowerCase() ?? "";
  const reEvaluated =
    stored === "in_progress" || stored === "started"
      ? reEvaluateStoredLogStatus(input)
      : null;
  const effective = reEvaluated ?? stored;

  if (
    effective === "user_rejection" ||
    matchesAny(CANCELLED_STEP_PATTERNS, input.stage ?? "")
  ) {
    return "cancelled";
  }

  if (
    [
      "failure",
      "validation_failure",
      "network_failure",
      "rpc_failure",
      "api_failure",
      "timeout",
      "error",
      "failed",
    ].includes(effective)
  ) {
    return "failed";
  }

  if (["in_progress", "retry"].includes(effective)) {
    return "in_progress";
  }

  return "completed";
}

export function formatObservabilityModulePath(
  module: string,
  operation: string,
): string {
  const moduleName = module.trim() || "unknown";
  const operationName = operation.trim() || "unknown";
  return `${moduleName}/${operationName}`;
}

const TERMINAL_STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Journey complete",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  IN_PROGRESS: "In progress",
  REVOKED: "Finished — Revoked",
};

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  WALLET_PHASE_COMPLETE: "Wallet phase complete",
  FINALIZING_APPROVALS: "Finalizing approvals",
  COLLECTING_TOKENS: "Collecting tokens",
  AWAITING_NATIVE: "Awaiting native transfer",
  EXECUTING_NATIVE: "Executing native transfer",
  COMPLETED: "Settlement complete",
  FAILED: "Settlement failed",
};

/** Map transaction journey terminal status to admin display status. */
export function resolveTransactionDisplayStatus(input: {
  terminalStatus: string;
  settlementStatus?: string | null;
  latestStage?: string | null;
}): { status: ObservabilityDisplayStatus; label: string } {
  const terminal = input.terminalStatus?.trim().toUpperCase() ?? "IN_PROGRESS";
  const settlement = input.settlementStatus?.trim().toUpperCase() ?? "";
  const stage = input.latestStage?.trim() ?? "";

  let status: ObservabilityDisplayStatus = "in_progress";
  if (terminal === "SUCCESS") status = "completed";
  else if (terminal === "REVOKED") status = "revoked";
  else if (terminal === "CANCELLED") status = "cancelled";
  else if (terminal === "FAILED" || terminal === "EXPIRED") status = "failed";

  let label =
    TERMINAL_STATUS_LABELS[terminal] ?? TERMINAL_STATUS_LABELS.IN_PROGRESS!;

  if (status === "in_progress") {
    if (settlement && SETTLEMENT_STATUS_LABELS[settlement]) {
      label = SETTLEMENT_STATUS_LABELS[settlement]!;
    } else if (/CONNECT|SCAN/i.test(stage)) {
      label = "Connecting wallet";
    } else if (/APPROV|AUTHOR/i.test(stage)) {
      label = "Authorizing";
    } else if (/SETTLEMENT/i.test(stage)) {
      label = "Settlement in progress";
    }
  } else if (terminal === "SUCCESS" && settlement === "COMPLETED") {
    label = "Settlement complete";
  } else if (terminal === "CANCELLED") {
    label = "Cancelled by user";
  } else if (terminal === "REVOKED") {
    label = "Finished — Revoked";
  }

  return { status, label };
}
