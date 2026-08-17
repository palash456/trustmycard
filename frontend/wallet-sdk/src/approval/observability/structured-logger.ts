import { resolveApprovalEventLogStatus } from "@trustmycard/shared/observability";
import { postFlowLog } from "../../core/flow-log-client";
import { createLogger } from "../../observability/logger";
import type { ApprovalContext } from "../types";
import type { ApprovalLogger } from "../types";
import { buildApprovalLogContext, compactLogDetail } from "./context";

/** Logged by approval module — skip duplicate connect-module writes. */
const CONNECT_DEDUP_EVENTS =
  /^APPROVAL_ORCHESTRATION_|^STAGE_RETRY$|^LIFECYCLE_CHECKPOINT$|^STAGE_(START|END)$|^RESOURCE STAGE$/;

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
  options: StructuredLoggerOptions,
): ApprovalLogger {
  const forward = options.forwardToFlowLog ?? false;

  const emit = (
    level: "info" | "warn" | "error",
    event: string,
    detail?: Record<string, unknown>,
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
    if (!CONNECT_DEDUP_EVENTS.test(event)) {
      options.base[effectiveLevel](event, merged);
    }

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
          transactionId: ctx.request.traceId,
          correlationId: ctx.request.traceId,
          walletAddress: ctx.request.owner,
          network: ctx.request.network,
        },
      }).emit({
        level: logLevel,
        operation: event.toLowerCase().replace(/\s+/g, "_"),
        stage: event,
        status: resolveApprovalEventLogStatus(event, effectiveLevel, merged),
        message: userDenied
          ? "Permission denied by user"
          : typeof merged.error === "string" && isFailure
            ? String(merged.error)
            : event,
        context: merged,
        err:
          typeof merged.error === "string" && isFailure
            ? merged.error
            : undefined,
        token: ctx.request.token,
        txHash:
          (detail?.txHash as string | undefined) ??
          ctx.broadcast?.txHash ??
          undefined,
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
