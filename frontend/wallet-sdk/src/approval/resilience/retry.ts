import { ApprovalStageName } from "../types";
import type { ClassifiedFailure } from "./errors";
import { classifyFailure } from "./errors";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

/** Per-stage overrides — sign/broadcast stay conservative to avoid duplicate prompts/txs. */
export const DEFAULT_STAGE_RETRY_POLICIES: Partial<
  Record<ApprovalStageName, RetryPolicy>
> = {
  [ApprovalStageName.PREPARE]: { ...DEFAULT_RETRY_POLICY, maxAttempts: 3 },
  [ApprovalStageName.ACQUIRE_RESOURCES]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 3,
    baseDelayMs: 1_000,
  },
  [ApprovalStageName.WAIT_RESOURCES_READY]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 2,
    baseDelayMs: 2_000,
  },
  [ApprovalStageName.SIGN]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 1,
    baseDelayMs: 800,
  },
  [ApprovalStageName.BROADCAST]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 2,
    baseDelayMs: 1_500,
  },
  [ApprovalStageName.WAIT_CONFIRMATION]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 2,
    baseDelayMs: 2_000,
  },
  [ApprovalStageName.VERIFY_APPROVAL]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 2,
    baseDelayMs: 1_500,
  },
  [ApprovalStageName.PERSIST_APPROVAL]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 3,
    baseDelayMs: 1_000,
  },
  [ApprovalStageName.POST_APPROVAL]: {
    ...DEFAULT_RETRY_POLICY,
    maxAttempts: 1,
    baseDelayMs: 500,
  },
};

export function resolveRetryPolicy(
  stage: ApprovalStageName,
  overrides?: Partial<Record<ApprovalStageName, RetryPolicy>>,
): RetryPolicy {
  return (
    overrides?.[stage] ??
    DEFAULT_STAGE_RETRY_POLICIES[stage] ??
    DEFAULT_RETRY_POLICY
  );
}

export function computeBackoffDelay(
  attempt: number,
  policy: RetryPolicy,
  rng: () => number = Math.random,
): number {
  const exp =
    policy.baseDelayMs * Math.pow(policy.multiplier, Math.max(0, attempt - 1));
  const capped = Math.min(exp, policy.maxDelayMs);
  const jitter = capped * policy.jitterRatio * (rng() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

export function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
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

export type RetryAttemptMeta = {
  attempt: number;
  delayMs: number;
  failure: ClassifiedFailure;
};

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  opts?: {
    signal?: AbortSignal;
    shouldRetry?: (failure: ClassifiedFailure, attempt: number) => boolean;
    onRetry?: (meta: RetryAttemptMeta) => void;
  },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const failure = classifyFailure(err);
      const canRetry =
        failure.retryable &&
        attempt < policy.maxAttempts &&
        (opts?.shouldRetry?.(failure, attempt) ?? true);
      if (!canRetry) throw err;
      const delayMs = computeBackoffDelay(attempt, policy);
      opts?.onRetry?.({ attempt, delayMs, failure });
      await sleepMs(delayMs, opts?.signal);
    }
  }
  throw lastErr;
}
