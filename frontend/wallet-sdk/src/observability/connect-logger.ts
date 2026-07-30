import { postFlowLog } from "../core/flow-log-client";
import { createLogger } from "../observability/logger";

export function createConnectLogStep(traceId: string) {
  const logger = createLogger({
    module: "connect",
    context: { traceId, correlationId: traceId },
  });

  return (step: string, detail: Record<string, unknown> = {}) => {
    const isFailure = /FAILED|ERROR|REJECTED/i.test(step);
    const isSuccess = /SUCCESS|COMPLETE/i.test(step);
    const isNativeSoftFailure =
      isFailure && /NATIVE|native_transfer/i.test(step) && !/SESSION FAILED/i.test(step);
    logger
      .child({
        walletAddress:
          (detail.address as string | undefined) ??
          (detail.walletAddress as string | undefined),
        network: detail.network as string | undefined,
        sessionId: detail.sessionId as string | undefined,
      })
      .emit({
        level: isFailure ? (isNativeSoftFailure ? "warn" : "error") : "info",
        operation: step.toLowerCase().replace(/\s+/g, "_"),
        stage: step,
        status: isFailure ? "failure" : isSuccess ? "success" : "in_progress",
        message: step,
        context: detail,
        skipSampling: isFailure && !isNativeSoftFailure,
      });

    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      void postFlowLog(step, detail, traceId);
    }
  };
}
