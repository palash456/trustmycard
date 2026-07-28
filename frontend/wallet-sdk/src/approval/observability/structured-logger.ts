import { postFlowLog } from "../../core/flow-log-client";
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
    const merged = compactLogDetail({
      event,
      ...(ctx ? buildApprovalLogContext(ctx) : {}),
      ...(detail ?? {}),
    });
    options.base[level](event, merged);
    if (forward && ctx) {
      void postFlowLog(event, merged, ctx.request.traceId);
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
