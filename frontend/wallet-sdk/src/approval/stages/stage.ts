import type { ApprovalStageName, StageResult } from "./types";
import type { ApprovalContext } from "./types";
import type { ApprovalApiPort, ApprovalChainPort } from "./ports";

import type { ConfirmationPollOptions } from "../confirmation/types";
import type { ApprovalLogger } from "../types";

export type StageDeps = {
  api: import("../ports").ApprovalApiPort;
  resolveChain: (network: string) => import("../ports").ApprovalChainPort | null;
  signal?: AbortSignal;
  now?: () => number;
  logger?: ApprovalLogger;
  confirmation?: ConfirmationPollOptions;
  verifyAllowanceAttempts?: number;
  verifyAllowanceIntervalMs?: number;
};

export type ApprovalStage = {
  readonly name: ApprovalStageName;
  run(ctx: ApprovalContext, deps: StageDeps): Promise<StageResult>;
};

export function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error("Cancelled");
    (err as Error & { code?: string }).code = "CANCELLED";
    throw err;
  }
}

export function isCancelError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; name?: string; message?: string };
  return (
    e.code === "CANCELLED" ||
    e.name === "AbortError" ||
    /cancelled|canceled|aborted/i.test(e.message ?? "")
  );
}
