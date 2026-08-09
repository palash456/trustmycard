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
import {
  assertNotCancelled,
  isCancelError,
  type ApprovalStage,
  type StageDeps,
} from "./stage";

export const broadcastStage: ApprovalStage = {
  name: ApprovalStageName.BROADCAST,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared || !ctx.signed) {
      return failStageFromError(
        ApprovalStageName.BROADCAST,
        new Error("Missing prepared or signed approval"),
      );
    }
    if (
      stageHasArtifact(ApprovalStageName.BROADCAST, ctx) &&
      ctx.broadcast?.txHash
    ) {
      return skippedStage(
        ApprovalStageName.BROADCAST,
        `Already broadcast (${ctx.broadcast.txHash})`,
      );
    }
    const chain = deps.resolveChain(ctx.request.network);
    if (!chain) {
      return failStageFromError(
        ApprovalStageName.BROADCAST,
        new Error(`No chain adapter for network ${ctx.request.network}`),
      );
    }
    try {
      assertNotCancelled(deps.signal);
      const broadcast = await chain.broadcast({
        signed: ctx.signed,
        prepared: ctx.prepared,
        signal: deps.signal,
      });
      if (!broadcast.txHash) {
        return failStageFromError(
          ApprovalStageName.BROADCAST,
          new Error("Broadcast returned empty tx hash"),
        );
      }
      ctx.broadcast = broadcast;
      return okStage(
        ApprovalStageName.BROADCAST,
        broadcast,
        (deps.now ?? Date.now)() - started,
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.BROADCAST);
      }
      return failStageFromError(ApprovalStageName.BROADCAST, err);
    }
  },
};
