import { failStageFromError } from "../resilience/errors";
import {
  ApprovalStageName,
  cancelledStage,
  failStage,
  okStage,
  type ApprovalContext,
  type StageResult,
} from "../types";
import {
  assertNotCancelled,
  isCancelError,
  type ApprovalStage,
  type StageDeps,
} from "./stage";

/**
 * Persists approval metadata after successful on-chain verification.
 */
export const persistApprovalStage: ApprovalStage = {
  name: ApprovalStageName.PERSIST_APPROVAL,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared || !ctx.broadcast?.txHash) {
      return failStage(
        ApprovalStageName.PERSIST_APPROVAL,
        "Missing prepared approval or tx hash",
      );
    }
    if (!ctx.confirmation?.confirmed) {
      return failStage(
        ApprovalStageName.PERSIST_APPROVAL,
        "Cannot persist before transaction confirmation",
        { retryable: true },
      );
    }
    if (!ctx.verified?.hasAllowance) {
      return failStage(
        ApprovalStageName.PERSIST_APPROVAL,
        "Cannot persist before allowance verification",
        { retryable: true },
      );
    }

    if (ctx.persisted?.approvalId) {
      return okStage(ApprovalStageName.PERSIST_APPROVAL, ctx.persisted, 0);
    }

    try {
      assertNotCancelled(deps.signal);
      const persisted = await deps.api.persistApproval({
        request: ctx.request,
        prepared: ctx.prepared,
        txHash: ctx.broadcast.txHash,
        verified: ctx.verified,
        signal: deps.signal,
      });
      ctx.persisted = persisted;
      return okStage(
        ApprovalStageName.PERSIST_APPROVAL,
        persisted,
        (deps.now ?? Date.now)() - started,
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.PERSIST_APPROVAL);
      }
      return failStageFromError(ApprovalStageName.PERSIST_APPROVAL, err);
    }
  },
};
