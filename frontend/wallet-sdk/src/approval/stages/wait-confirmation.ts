import { waitForTransactionConfirmation } from "../confirmation/poller";
import { getErrorMessage } from "../../core/errors";
import { failStageFromError } from "../resilience/errors";
import {
  ApprovalStageName,
  cancelledStage,
  failStage,
  okStage,
  timeoutStage,
  type ApprovalContext,
  type StageResult,
} from "../types";
import {
  assertNotCancelled,
  isCancelError,
  type ApprovalStage,
  type StageDeps,
} from "./stage";

export const waitConfirmationStage: ApprovalStage = {
  name: ApprovalStageName.WAIT_CONFIRMATION,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    const txHash = ctx.broadcast?.txHash;
    if (!txHash) {
      return failStage(
        ApprovalStageName.WAIT_CONFIRMATION,
        "Missing broadcast tx hash",
      );
    }

    // Already confirmed (e.g. resumed checkpoint).
    if (ctx.confirmation?.confirmed) {
      return okStage(ApprovalStageName.WAIT_CONFIRMATION, ctx.confirmation, 0);
    }

    const chain = deps.resolveChain(ctx.request.network);
    if (!chain) {
      return failStage(
        ApprovalStageName.WAIT_CONFIRMATION,
        `No chain adapter for network ${ctx.request.network}`,
      );
    }

    try {
      assertNotCancelled(deps.signal);
      const pollOptions = deps.confirmation ?? {};
      const result = await waitForTransactionConfirmation(chain, {
        txHash,
        network: ctx.request.network,
        signal: deps.signal,
        now: deps.now,
        ...pollOptions,
        onAttempt: (attempt, snapshot) => {
          pollOptions.onAttempt?.(attempt, snapshot);
          deps.logger?.info("CONFIRMATION_POLL", {
            attempt,
            status: snapshot.status,
            txHash,
            traceId: ctx.request.traceId,
          });
        },
      });

      ctx.confirmation = {
        txHash: result.txHash,
        waitedMs: result.waitedMs,
        blockNumber: result.blockNumber ?? null,
        confirmations: result.confirmations,
        confirmed: true,
        attempts: result.attempts,
      };

      return okStage(
        ApprovalStageName.WAIT_CONFIRMATION,
        ctx.confirmation,
        (deps.now ?? Date.now)() - started,
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.WAIT_CONFIRMATION);
      }
      const code = (err as { code?: string })?.code;
      if (code === "CONFIRMATION_TIMEOUT") {
        return timeoutStage(
          ApprovalStageName.WAIT_CONFIRMATION,
          getErrorMessage(err, "Confirmation timed out"),
        );
      }
      return failStageFromError(ApprovalStageName.WAIT_CONFIRMATION, err);
    }
  },
};
