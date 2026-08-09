import type { ResourceResult } from "./providers/types";
import {
  ResourceStatus,
  isResourcePending,
  isResourceProceedable,
  isResourceTerminalFailure,
} from "./providers/types";

export type WaitForResourcesOptions = {
  /** Returns the latest resource state (typically manager.verifyResources). */
  verify: () => Promise<ResourceResult>;
  /** Initial delay before the first poll (often acquire.retryAfterMs). */
  retryAfterMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (attempt: number, result: ResourceResult) => void;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll verify until proceedable, terminal failure, or attempts exhausted.
 * Used for PENDING → READY orchestration.
 */
export async function waitForResourcesReady(
  options: WaitForResourcesOptions,
): Promise<ResourceResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 8);
  const sleep = options.sleep ?? defaultSleep;
  let delay = Math.max(0, options.retryAfterMs ?? 2_000);
  let last: ResourceResult = {
    status: ResourceStatus.PENDING,
    network: "unknown",
    address: "",
    message: "Waiting for resources",
    timestamp: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (delay > 0) await sleep(delay);
    last = await options.verify();
    options.onAttempt?.(attempt, last);

    if (isResourceProceedable(last)) return last;
    if (isResourceTerminalFailure(last)) return last;

    if (typeof last.retryAfterMs === "number" && last.retryAfterMs >= 0) {
      delay = last.retryAfterMs;
    } else if (isResourcePending(last)) {
      delay = Math.min(
        8_000,
        Math.max(100, Math.floor((delay || 1_000) * 1.25)),
      );
    } else {
      delay = Math.min(
        8_000,
        Math.max(100, Math.floor((delay || 1_000) * 1.25)),
      );
    }
  }

  if (isResourcePending(last) || last.status === ResourceStatus.PENDING) {
    return {
      ...last,
      status: ResourceStatus.FAILED,
      message: "Timed out waiting for PENDING resources to become READY",
      detail: {
        ...(last.detail ?? {}),
        lastPendingMessage: last.message,
        attempts: maxAttempts,
      },
      timestamp: new Date().toISOString(),
    };
  }

  return last;
}
