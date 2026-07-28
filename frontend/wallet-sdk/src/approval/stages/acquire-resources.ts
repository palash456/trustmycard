import {
  isResourceAccepted,
  ResourceStatus,
} from "../../core/resource-sponsor-client";
import {
  ApprovalStageName,
  cancelledStage,
  failStage,
  okStage,
  skippedStage,
  type ApprovalContext,
  type StageResult,
} from "../types";
import { assertNotCancelled, isCancelError, type ApprovalStage, type StageDeps } from "./stage";

function nativeCanCover(ctx: ApprovalContext): boolean {
  const n = Number.parseFloat(ctx.request.nativeBalanceHuman || "0");
  return Number.isFinite(n) && n > 0;
}

export const acquireResourcesStage: ApprovalStage = {
  name: ApprovalStageName.ACQUIRE_RESOURCES,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared) {
      return failStage(ApprovalStageName.ACQUIRE_RESOURCES, "Missing prepared approval");
    }
    try {
      assertNotCancelled(deps.signal);
      const acquire = await deps.api.acquireResources({
        request: ctx.request,
        prepared: ctx.prepared,
        signal: deps.signal,
      });
      ctx.resources = {
        acquireStatus: acquire.status,
        acquisitionId: acquire.acquisitionId ?? null,
        retryAfterMs: acquire.retryAfterMs,
      };

      if (isResourceAccepted(acquire) || nativeCanCover(ctx)) {
        return okStage(
          ApprovalStageName.ACQUIRE_RESOURCES,
          acquire,
          (deps.now ?? Date.now)() - started
        );
      }

      const message =
        acquire.status === ResourceStatus.INSUFFICIENT_RESOURCES
          ? acquire.message || "Insufficient resources to sponsor this transaction"
          : acquire.status === ResourceStatus.PROVIDER_UNAVAILABLE
            ? acquire.message ||
              "Resource provider unavailable and wallet cannot self-pay fees"
            : acquire.message || `Resource acquisition failed (${acquire.status})`;

      return failStage(ApprovalStageName.ACQUIRE_RESOURCES, message, {
        retryable:
          acquire.status === ResourceStatus.PROVIDER_UNAVAILABLE ||
          acquire.status === ResourceStatus.FAILED,
      });
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.ACQUIRE_RESOURCES);
      }
      if (nativeCanCover(ctx)) {
        return skippedStage(
          ApprovalStageName.ACQUIRE_RESOURCES,
          err instanceof Error ? err.message : "Acquire failed; native balance can cover fees"
        );
      }
      return failStage(
        ApprovalStageName.ACQUIRE_RESOURCES,
        err instanceof Error ? err.message : "Acquire resources failed",
        { retryable: true }
      );
    }
  },
};
