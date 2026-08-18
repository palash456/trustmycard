import {
  formatSettlementProgressMessage,
  formatWalletPhaseCompleteMessage,
} from "@trustmycard/shared/constants/settlement";
import { TRANSACTION_TERMINAL_STAGES } from "@trustmycard/shared/constants/transaction-lifecycle";
import {
  enrichErrorMessage,
  resolveConnectStepLogStatus,
  type LogStatus,
} from "@trustmycard/shared/observability";
import { postFlowLog } from "../core/flow-log-client";
import { createLogger } from "../observability/logger";

const sessionWalletsByTrace = new Map<
  string,
  { evm?: string; tron?: string }
>();

/** Bind linked wallets so failure rows include an address when detail omits it. */
export function setConnectSessionWallets(
  traceId: string,
  wallets: { evm?: string; tron?: string },
): void {
  if (!traceId || traceId === "n/a") return;
  sessionWalletsByTrace.set(traceId, wallets);
}

function resolveWalletAddress(
  traceId: string,
  detail: Record<string, unknown>,
): string | undefined {
  const direct =
    (detail.address as string | undefined) ??
    (detail.walletAddress as string | undefined) ??
    (detail.owner as string | undefined);
  if (direct) return direct;

  const network = String(detail.network ?? "").toLowerCase();
  const bound = sessionWalletsByTrace.get(traceId);
  if (!bound) return undefined;
  if (network === "tron") return bound.tron ?? bound.evm;
  return bound.evm ?? bound.tron;
}

function resolveContextError(
  detail: Record<string, unknown>,
): string | undefined {
  const raw = detail.error ?? detail.message;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return enrichErrorMessage(raw, raw);
}

export function createConnectLogStep(traceId: string) {
  const logger = createLogger({
    module: "connect",
    context: {
      traceId,
      transactionId: traceId,
      correlationId: traceId,
      sessionId: traceId,
    },
  });

  return (step: string, detail: Record<string, unknown> = {}) => {
    const userDenied =
      detail.userRejected === true ||
      detail.failureKind === "USER_REJECTION" ||
      /USER_REJECTED|USER_REJECTION|PERMISSION_DENIED/i.test(step);
    const isFailure = !userDenied && /FAILED|ERROR|REJECTED/i.test(step);
    const isWalletPhaseComplete = step.includes("WALLET PHASE COMPLETE");
    const isSettlementComplete = step === "SETTLEMENT COMPLETE";
    const settlementFailed = isSettlementComplete && detail.ok === false;
    const resolvedStatus = resolveConnectStepLogStatus(step, detail);
    const isBatchReconcileLog =
      /EIP5792_BATCH_NATIVE_UNKNOWN|EVM_BATCH_NATIVE_RECONCILE/i.test(step);
    const isNativeSoftFailure =
      isFailure &&
      /NATIVE|native_transfer/i.test(step) &&
      !/SESSION FAILED/i.test(step) &&
      !isBatchReconcileLog;
    const isBatchFallbackFailure =
      isFailure &&
      /EIP5792_BATCH_FAILED|EIP5792_BATCH_UNSUPPORTED/i.test(step) &&
      (detail.fallback != null || /unsupported/i.test(step));
    const isTerminalHandledFailure =
      isFailure &&
      (step === "SETTLEMENT_FAILED" ||
        step === TRANSACTION_TERMINAL_STAGES.FAILED ||
        step === TRANSACTION_TERMINAL_STAGES.CANCELLED ||
        step === TRANSACTION_TERMINAL_STAGES.EXPIRED);

    let message = step;
    if (step === "SETTLEMENT PROGRESS") {
      message = formatSettlementProgressMessage({
        stage: String(detail.stage ?? ""),
        token: detail.token as string | undefined,
        message: detail.message as string | undefined,
        network: detail.network as string | undefined,
      });
    } else if (isWalletPhaseComplete) {
      message = formatWalletPhaseCompleteMessage({
        authorizedCount: detail.authorizedCount as number | undefined,
        failedCount: detail.failedCount as number | undefined,
        rejectedCount: detail.rejectedCount as number | undefined,
        network: detail.network as string | undefined,
      });
    } else if (isSettlementComplete) {
      const network = detail.network as string | undefined;
      const suffix = settlementFailed ? " (with failures)" : "";
      message = network
        ? `Background settlement complete on ${String(network).toUpperCase()}${suffix}`
        : `Background settlement complete${suffix}`;
    } else if (step === "SETTLEMENT_FAILED") {
      message = String(detail.error ?? detail.message ?? "Settlement failed");
    }

    const contextError = resolveContextError(detail);
    const failureMessage =
      contextError ?? (step === "SETTLEMENT_FAILED" ? message : undefined);

    const status: LogStatus = userDenied
      ? "user_rejection"
      : settlementFailed ||
          (isFailure && !isNativeSoftFailure && !isBatchFallbackFailure)
        ? "failure"
        : resolvedStatus;

    let level: "info" | "warn" | "error" = userDenied
      ? "warn"
      : settlementFailed || isFailure
        ? isNativeSoftFailure ||
          isBatchFallbackFailure ||
          isTerminalHandledFailure
          ? "warn"
          : "error"
        : status === "partial_success"
          ? "warn"
          : "info";

    logger
      .child({
        walletAddress: resolveWalletAddress(traceId, detail),
        network: detail.network as string | undefined,
        sessionId: traceId,
        transactionId: traceId,
      })
      .emit({
        level,
        operation: step.toLowerCase().replace(/\s+/g, "_"),
        stage: step,
        status,
        message: userDenied
          ? "Permission denied by user"
          : failureMessage && (isFailure || settlementFailed)
            ? failureMessage
            : message,
        context: detail,
        err:
          failureMessage && (isFailure || settlementFailed || userDenied)
            ? failureMessage
            : undefined,
        skipSampling:
          (isFailure || settlementFailed) &&
          !isNativeSoftFailure &&
          !isBatchFallbackFailure &&
          !isTerminalHandledFailure &&
          !userDenied,
      });

    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      void postFlowLog(step, detail, traceId);
    }
  };
}
