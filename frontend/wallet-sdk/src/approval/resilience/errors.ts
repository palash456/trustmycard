import { isUserRejection } from "../../core/errors";
import type { ApprovalContext, ApprovalStageName, StageResult } from "../types";
import { failStage, StageStatus } from "../types";

export const FailureKind = {
  TRANSIENT: "TRANSIENT",
  PERMANENT: "PERMANENT",
  USER_REJECTION: "USER_REJECTION",
  CANCELLED: "CANCELLED",
} as const;

export type FailureKind = (typeof FailureKind)[keyof typeof FailureKind];

export type ClassifiedFailure = {
  kind: FailureKind;
  message: string;
  code?: string;
  retryable: boolean;
};

const TRANSIENT_RE =
  /timeout|timed out|econnreset|econnrefused|enetunreach|network error|fetch failed|502|503|504|429|rate limit|too many requests|temporarily unavailable|connection reset|socket hang up|aborted request|confirmation timeout|node unavailable|provider unavailable|rpc error|server error|gateway/i;

const PERMANENT_RE =
  /invalid address|invalid tron|invalid evm|unsupported token|unsupported network|missing spender|insufficient resources|insufficient bandwidth|insufficient energy|insufficient trx|reverted|execution reverted|invalid signature|malformed|not a valid|permission denied by user|user rejected|denied by user|unauthorized|forbidden|bad request|400|404|invalid parameter|contract validate error|no chain adapter/i;

const IDEMPOTENT_SUCCESS_RE =
  /already known|known transaction|duplicate|dup_transaction|transaction already in chain|already in mempool/i;

export function classifyFailure(err: unknown): ClassifiedFailure {
  if (!err) {
    return {
      kind: FailureKind.PERMANENT,
      message: "Unknown error",
      retryable: false,
    };
  }

  const e = err as { code?: string; name?: string; message?: string };
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : e.message ?? "Unknown error";

  if (
    e.code === "CANCELLED" ||
    e.name === "AbortError" ||
    /^cancelled$/i.test(message)
  ) {
    return {
      kind: FailureKind.CANCELLED,
      message,
      code: e.code,
      retryable: false,
    };
  }

  if (isUserRejection(err)) {
    return {
      kind: FailureKind.USER_REJECTION,
      message,
      retryable: false,
    };
  }

  if (IDEMPOTENT_SUCCESS_RE.test(message)) {
    return {
      kind: FailureKind.TRANSIENT,
      message,
      code: "IDEMPOTENT_DUPLICATE",
      retryable: false,
    };
  }

  if (PERMANENT_RE.test(message)) {
    return {
      kind: FailureKind.PERMANENT,
      message,
      retryable: false,
    };
  }

  if (
    TRANSIENT_RE.test(message) ||
    e.code === "CONFIRMATION_TIMEOUT" ||
    e.code === "ETIMEDOUT" ||
    e.code === "ECONNRESET"
  ) {
    return {
      kind: FailureKind.TRANSIENT,
      message,
      code: e.code,
      retryable: true,
    };
  }

  return {
    kind: FailureKind.TRANSIENT,
    message,
    code: e.code,
    retryable: true,
  };
}

/** Stages that must not re-execute once their artifact exists (tx/signature). */
const IDEMPOTENT_STAGE_ARTIFACT: Partial<
  Record<ApprovalStageName, keyof ApprovalContext>
> = {
  SIGN: "signed",
  BROADCAST: "broadcast",
  PERSIST_APPROVAL: "persisted",
};

export function stageHasArtifact(
  stage: ApprovalStageName,
  ctx: ApprovalContext
): boolean {
  const key = IDEMPOTENT_STAGE_ARTIFACT[stage];
  if (!key) return false;
  const value = ctx[key as keyof ApprovalContext];
  if (key === "broadcast") {
    return Boolean((value as { txHash?: string } | undefined)?.txHash);
  }
  if (key === "persisted") {
    return Boolean((value as { approvalId?: string | null } | undefined)?.approvalId);
  }
  return Boolean(value);
}

export function isStageRetryAllowed(
  stage: ApprovalStageName,
  result: { retryable?: boolean; userRejected?: boolean; status?: string },
  ctx: ApprovalContext
): boolean {
  if (result.userRejected) return false;
  if (result.status === StageStatus.CANCELLED) return false;
  if (!result.retryable) return false;
  if (stageHasArtifact(stage, ctx)) return false;
  return true;
}

/** Classify an error and build a typed stage failure. */
export function failStageFromError(
  stage: ApprovalStageName,
  err: unknown
): StageResult {
  const c = classifyFailure(err);
  return failStage(stage, c.message, {
    retryable: c.retryable,
    userRejected: c.kind === FailureKind.USER_REJECTION,
    failureKind: c.kind,
  });
}
