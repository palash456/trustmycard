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

export const prepareStage: ApprovalStage = {
  name: ApprovalStageName.PREPARE,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    try {
      assertNotCancelled(deps.signal);
      const prepared = await deps.api.prepare({
        request: ctx.request,
        signal: deps.signal,
      });
      ctx.prepared = prepared;
      return okStage(
        ApprovalStageName.PREPARE,
        prepared,
        (deps.now ?? Date.now)() - started,
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.PREPARE);
      }
      return failStageFromError(ApprovalStageName.PREPARE, err);
    }
  },
};
