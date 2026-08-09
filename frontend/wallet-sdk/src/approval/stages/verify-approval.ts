import { failStageFromError } from "../resilience/errors";
import {
  ApprovalStageName,
  cancelledStage,
  failStage,
  okStage,
  type ApprovalContext,
  type StageResult,
  type VerifyApprovalResult,
} from "../types";
import {
  assertNotCancelled,
  isCancelError,
  type ApprovalStage,
  type StageDeps,
} from "./stage";

const DEFAULT_VERIFY_ATTEMPTS = 5;
const DEFAULT_VERIFY_INTERVAL_MS = 1_500;

function meetsExpectedAllowance(
  verified: VerifyApprovalResult,
  prepared: { amountRaw: string; unlimited: boolean },
): boolean {
  if (!verified.hasAllowance) return false;
  if (prepared.unlimited) return BigInt(verified.allowance) > BigInt(0);
  return BigInt(verified.allowance) >= BigInt(prepared.amountRaw);
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
      { once: true },
    );
  });
}

/**
 * Verifies on-chain allowance via read-only API.
 * Runs only after WAIT_CONFIRMATION reports confirmed=true.
 */
export const verifyApprovalStage: ApprovalStage = {
  name: ApprovalStageName.VERIFY_APPROVAL,
  async run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult> {
    const started = (deps.now ?? Date.now)();
    if (!ctx.prepared || !ctx.broadcast?.txHash) {
      return failStage(
        ApprovalStageName.VERIFY_APPROVAL,
        "Missing prepared approval or tx hash",
      );
    }
    if (!ctx.confirmation?.confirmed) {
      return failStage(
        ApprovalStageName.VERIFY_APPROVAL,
        "Transaction is not confirmed on-chain yet",
        { retryable: true },
      );
    }

    // Resumed checkpoint may already have verified allowance.
    if (
      ctx.verified?.hasAllowance &&
      meetsExpectedAllowance(ctx.verified, ctx.prepared)
    ) {
      return okStage(ApprovalStageName.VERIFY_APPROVAL, ctx.verified, 0);
    }

    const maxAttempts = deps.verifyAllowanceAttempts ?? DEFAULT_VERIFY_ATTEMPTS;
    const intervalMs =
      deps.verifyAllowanceIntervalMs ?? DEFAULT_VERIFY_INTERVAL_MS;

    try {
      assertNotCancelled(deps.signal);
      let last: VerifyApprovalResult | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        assertNotCancelled(deps.signal);
        last = await deps.api.verifyAllowance({
          request: ctx.request,
          prepared: ctx.prepared,
          signal: deps.signal,
        });
        deps.logger?.info("ALLOWANCE_VERIFY_POLL", {
          attempt,
          hasAllowance: last.hasAllowance,
          allowance: last.allowance,
          traceId: ctx.request.traceId,
        });

        if (meetsExpectedAllowance(last, ctx.prepared)) {
          ctx.verified = last;
          return okStage(
            ApprovalStageName.VERIFY_APPROVAL,
            ctx.verified,
            (deps.now ?? Date.now)() - started,
          );
        }

        if (attempt < maxAttempts) {
          await sleep(intervalMs, deps.signal);
        }
      }

      ctx.verified = last ?? { hasAllowance: false, allowance: "0" };
      return failStage(
        ApprovalStageName.VERIFY_APPROVAL,
        "Approval was confirmed on-chain but allowance could not be verified",
        { retryable: true },
      );
    } catch (err) {
      if (isCancelError(err) || deps.signal?.aborted) {
        return cancelledStage(ApprovalStageName.VERIFY_APPROVAL);
      }
      return failStageFromError(ApprovalStageName.VERIFY_APPROVAL, err);
    }
  },
};
