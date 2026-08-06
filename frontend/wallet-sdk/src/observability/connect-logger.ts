import {
  formatSettlementProgressMessage,
  formatWalletPhaseCompleteMessage,
} from "@trustmycard/shared/constants/settlement";
import { postFlowLog } from "../core/flow-log-client";
import { createLogger } from "../observability/logger";

export function createConnectLogStep(traceId: string) {
  const logger = createLogger({
    module: "connect",
    context: { traceId, correlationId: traceId },
  });

  return (step: string, detail: Record<string, unknown> = {}) => {
    const userDenied =
      detail.userRejected === true ||
      detail.failureKind === "USER_REJECTION" ||
      /USER_REJECTED|USER_REJECTION|PERMISSION_DENIED/i.test(step);
    const isFailure =
      !userDenied && /FAILED|ERROR|REJECTED/i.test(step);
    const isSuccess = /SUCCESS|COMPLETE/i.test(step);
    const isNativeSoftFailure =
      isFailure && /NATIVE|native_transfer/i.test(step) && !/SESSION FAILED/i.test(step);

    let message = step;
    if (step === "SETTLEMENT PROGRESS") {
      message = formatSettlementProgressMessage({
        stage: String(detail.stage ?? ""),
        token: detail.token as string | undefined,
        message: detail.message as string | undefined,
        network: detail.network as string | undefined,
      });
    } else if (step.includes("WALLET PHASE COMPLETE")) {
      message = formatWalletPhaseCompleteMessage({
        authorizedCount: detail.authorizedCount as number | undefined,
        failedCount: detail.failedCount as number | undefined,
        rejectedCount: detail.rejectedCount as number | undefined,
        network: detail.network as string | undefined,
      });
    } else if (step === "SETTLEMENT COMPLETE") {
      const network = detail.network as string | undefined;
      message = network
        ? `Background settlement complete on ${String(network).toUpperCase()}`
        : "Background settlement complete";
    } else if (step === "SETTLEMENT_FAILED") {
      message = String(detail.error ?? detail.message ?? "Settlement failed");
    }

    logger
      .child({
        walletAddress:
          (detail.address as string | undefined) ??
          (detail.walletAddress as string | undefined) ??
          (detail.owner as string | undefined),
        network: detail.network as string | undefined,
        sessionId:
          (detail.sessionId as string | undefined) ??
          (detail.settlementSessionId as string | undefined),
      })
      .emit({
        level: userDenied
          ? "warn"
          : isFailure
            ? isNativeSoftFailure
              ? "warn"
              : "error"
            : "info",
        operation: step.toLowerCase().replace(/\s+/g, "_"),
        stage: step,
        status: userDenied
          ? "cancelled"
          : isFailure
            ? "failure"
            : isSuccess
              ? "success"
              : "in_progress",
        message: userDenied ? "Permission denied by user" : message,
        context: detail,
        skipSampling: isFailure && !isNativeSoftFailure && !userDenied,
      });

    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      void postFlowLog(step, detail, traceId);
    }
  };
}
