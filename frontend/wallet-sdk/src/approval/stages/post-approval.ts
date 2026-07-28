import {
  ApprovalStageName,
  cancelledStage,
  failStage,
  okStage,
  type ApprovalContext,
  type StageResult,
} from "../types";
import { assertNotCancelled, isCancelError, type ApprovalStage, type StageDeps } from "./stage";

/**
 * Post-approval side effects (Telegram / analytics logging, etc.).
 * Failures here do not roll back a successful approval — returned as FAILED
 * with retryable=true but orchestrator treats this stage as soft.
 */
export const postApprovalStage: ApprovalStage = {
  name: ApprovalStageName.POST_APPROVAL,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    try {
      assertNotCancelled(deps.signal);
      const post = await deps.api.postApprovalLog({
        request: ctx.request,
        ok: true,
        signal: deps.signal,
      });
      ctx.post = post;
      return okStage(
        ApprovalStageName.POST_APPROVAL,
        post,
        (deps.now ?? Date.now)() - started
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.POST_APPROVAL);
      }
      ctx.post = { logged: false };
      return failStage(
        ApprovalStageName.POST_APPROVAL,
        err instanceof Error ? err.message : "Post-approval actions failed",
        { retryable: true }
      );
    }
  },
};
