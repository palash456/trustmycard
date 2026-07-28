import {
  ApprovalStageName,
  cancelledStage,
  okStage,
  skippedStage,
  type ApprovalContext,
  type StageResult,
} from "../types";
import { failStageFromError } from "../resilience/errors";
import { stageHasArtifact } from "../resilience/errors";
import { assertNotCancelled, isCancelError, type ApprovalStage, type StageDeps } from "./stage";

export const signStage: ApprovalStage = {
  name: ApprovalStageName.SIGN,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared) {
      return failStageFromError(
        ApprovalStageName.SIGN,
        new Error("Missing prepared approval")
      );
    }
    if (stageHasArtifact(ApprovalStageName.SIGN, ctx) && ctx.signed) {
      return skippedStage(ApprovalStageName.SIGN, "Already signed");
    }
    const chain = deps.resolveChain(ctx.request.network);
    if (!chain) {
      return failStageFromError(
        ApprovalStageName.SIGN,
        new Error(`No chain adapter for network ${ctx.request.network}`)
      );
    }
    try {
      assertNotCancelled(deps.signal);
      const signed = await chain.sign({
        prepared: ctx.prepared,
        owner: ctx.request.owner,
        signal: deps.signal,
      });
      ctx.signed = signed;
      return okStage(ApprovalStageName.SIGN, signed, (deps.now ?? Date.now)() - started);
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.SIGN);
      }
      return failStageFromError(ApprovalStageName.SIGN, err);
    }
  },
};
