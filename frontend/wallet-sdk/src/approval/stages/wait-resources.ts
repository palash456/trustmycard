import {
  isResourcePending,
  isResourceProceedable,
  ResourceStatus,
  waitUntilResourcesReady,
  type ResourceResult,
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

export const waitResourcesReadyStage: ApprovalStage = {
  name: ApprovalStageName.WAIT_RESOURCES_READY,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared) {
      return failStage(ApprovalStageName.WAIT_RESOURCES_READY, "Missing prepared approval");
    }

    const acquireStatus = ctx.resources?.acquireStatus;
    const alreadyReady =
      acquireStatus === ResourceStatus.READY ||
      acquireStatus === ResourceStatus.ALREADY_AVAILABLE;

    if (alreadyReady) {
      return skippedStage(
        ApprovalStageName.WAIT_RESOURCES_READY,
        `Resources already ${acquireStatus}`
      );
    }

    try {
      assertNotCancelled(deps.signal);

      const pending =
        acquireStatus === ResourceStatus.PENDING ||
        acquireStatus === ResourceStatus.ACQUIRED;

      let verified: ResourceResult;
      if (pending) {
        // Prefer port verify via wait helper when using HTTP client;
        // stages call api.verifyResources through a thin poll loop for testability.
        const maxAttempts = acquireStatus === ResourceStatus.PENDING ? 8 : 3;
        const retryAfterMs = ctx.resources?.retryAfterMs ?? 2_500;
        let last: ResourceResult | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          assertNotCancelled(deps.signal);
          last = await deps.api.verifyResources({
            request: ctx.request,
            prepared: ctx.prepared,
            signal: deps.signal,
          });
          if (isResourceProceedable(last) || isTerminalFail(last)) {
            verified = last;
            break;
          }
          if (attempt < maxAttempts) {
            await sleep(retryAfterMs, deps.signal);
          }
        }
        verified = last!;
      } else {
        verified = await deps.api.verifyResources({
          request: ctx.request,
          prepared: ctx.prepared,
          signal: deps.signal,
        });
      }

      if (isResourceProceedable(verified) || nativeCanCover(ctx)) {
        return okStage(
          ApprovalStageName.WAIT_RESOURCES_READY,
          verified,
          (deps.now ?? Date.now)() - started
        );
      }

      return failStage(
        ApprovalStageName.WAIT_RESOURCES_READY,
        verified.message || `Resources not ready (${verified.status})`,
        { retryable: isResourcePending(verified) }
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.WAIT_RESOURCES_READY);
      }
      if (nativeCanCover(ctx)) {
        return skippedStage(
          ApprovalStageName.WAIT_RESOURCES_READY,
          err instanceof Error ? err.message : "Wait failed; native can cover"
        );
      }
      return failStage(
        ApprovalStageName.WAIT_RESOURCES_READY,
        err instanceof Error ? err.message : "Wait for resources failed",
        { retryable: true }
      );
    }
  },
};

function isTerminalFail(r: ResourceResult): boolean {
  return (
    r.status === ResourceStatus.FAILED ||
    r.status === ResourceStatus.INSUFFICIENT_RESOURCES ||
    r.status === ResourceStatus.PROVIDER_UNAVAILABLE
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      },
      { once: true }
    );
  });
}

/** Re-export for adapters that want the shared poll helper. */
export { waitUntilResourcesReady };
