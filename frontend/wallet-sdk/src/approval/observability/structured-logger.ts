import { postFlowLog } from "../../core/flow-log-client";
import { createLogger } from "../../observability/logger";
import type { ApprovalContext } from "../types";
import type { ApprovalLogger } from "../types";
import { buildApprovalLogContext, compactLogDetail } from "./context";

export type StructuredLoggerOptions = {
  base: ApprovalLogger;
  getContext?: () => ApprovalContext | null;
  /** Also forward to existing /api/approvals/debug flow log (backward compatible). */
  forwardToFlowLog?: boolean;
};

/**
 * Wraps ApprovalLogger with consistent approval context on every event.
 * Preserves the original logger interface for backward compatibility.
 */
export function createStructuredApprovalLogger(
  options: StructuredLoggerOptions
): ApprovalLogger {
  const forward = options.forwardToFlowLog ?? false;

  const emit = (
    level: "info" | "warn" | "error",
    event: string,
    detail?: Record<string, unknown>
  ) => {
    const ctx = options.getContext?.();
    const userDenied =
      detail?.userRejected === true ||
      detail?.failureKind === "USER_REJECTION" ||
      /USER_REJECTED|USER_REJECTION|PERMISSION_DENIED/i.test(event);
    const effectiveLevel = userDenied ? "warn" : level;
    const merged = compactLogDetail({
      event,
      ...(ctx ? buildApprovalLogContext(ctx) : {}),
      ...(detail ?? {}),
    });
    options.base[effectiveLevel](event, merged);

    if (ctx) {
      const logLevel =
        effectiveLevel === "error"
          ? "error"
          : effectiveLevel === "warn"
            ? "warn"
            : "info";
      const isFailure = effectiveLevel === "error";
      createLogger({
        module: "approval",
        context: {
          traceId: ctx.request.traceId,
          correlationId: ctx.request.traceId,
          sessionId: ctx.request.traceId,
          walletAddress: ctx.request.owner,
          network: ctx.request.network,
        },
      }).emit({
        level: logLevel,
        operation: event.toLowerCase().replace(/\s+/g, "_"),
        stage: event,
        status: userDenied ? "cancelled" : isFailure ? "failure" : "in_progress",
        message: userDenied ? "Permission denied by user" : event,
        context: merged,
        token: ctx.request.token,
        txHash: (detail?.txHash as string | undefined) ?? ctx.broadcast?.txHash ?? undefined,
        skipSampling: isFailure,
      });

      if (forward) {
        void postFlowLog(event, merged, ctx.request.traceId);
      }
    }
  };

  return {
    info: (event, detail) => emit("info", event, detail),
    warn: (event, detail) => emit("warn", event, detail),
    error: (event, detail) => emit("error", event, detail),
  };
}

export { buildApprovalLogContext, compactLogDetail } from "./context";
export type { ApprovalLogContext } from "./context";
