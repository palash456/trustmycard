import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";
import { getErrorMessage } from "../core/errors";

export type NativeClientPolicy = {
  lockTtlMs: number;
  confirmRetryDelaysMs: readonly number[];
  registerRetryDelaysMs: readonly number[];
  estimateMaxUnderflowBps: number;
};

const FALLBACK_POLICY: NativeClientPolicy = {
  lockTtlMs: 120_000,
  confirmRetryDelaysMs: [2_000, 5_000, 10_000, 20_000, 30_000],
  registerRetryDelaysMs: [1_000, 2_000, 5_000, 10_000, 15_000, 20_000],
  estimateMaxUnderflowBps: 200,
};

let activePolicy: NativeClientPolicy = FALLBACK_POLICY;

export function nativeClientPolicyFromPlatform(
  platform?: PublicPlatformConfig
): NativeClientPolicy {
  if (!platform?.native) return FALLBACK_POLICY;
  return {
    lockTtlMs: platform.native.transferLockTtlMs,
    confirmRetryDelaysMs: platform.native.confirmRetryDelaysMs,
    registerRetryDelaysMs: platform.native.registerRetryDelaysMs,
    estimateMaxUnderflowBps: platform.native.estimateMaxUnderflowBps,
  };
}

/** Install policy from platform config (call once when ConnectFlow mounts). */
export function setNativeClientPolicy(policy: NativeClientPolicy): void {
  activePolicy = policy;
}

function policy(): NativeClientPolicy {
  return activePolicy;
}

const NATIVE_TRANSFER_LOCK_KEY = "tmw-native-transfer-in-flight";

export function acquireNativeTransferLock(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const existing = sessionStorage.getItem(NATIVE_TRANSFER_LOCK_KEY);
  if (existing) {
    const started = Number.parseInt(existing, 10);
    if (Number.isFinite(started) && Date.now() - started < policy().lockTtlMs) {
      return false;
    }
  }
  sessionStorage.setItem(NATIVE_TRANSFER_LOCK_KEY, String(Date.now()));
  return true;
}

export function releaseNativeTransferLock(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(NATIVE_TRANSFER_LOCK_KEY);
}

function isRetryablePersistenceError(message: string): boolean {
  return /not found|still pending|still propagating|tx_not_visible/i.test(message);
}

export async function retryRegisterWithBackoff<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  delaysMs: readonly number[] = policy().registerRetryDelaysMs
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= delaysMs.length; i += 1) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = getErrorMessage(err);
      if (isRetryablePersistenceError(message)) {
        if (i < delaysMs.length) {
          await sleep(delaysMs[i], signal);
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Register retries exhausted");
}

export async function retryConfirmWithBackoff<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  delaysMs: readonly number[] = policy().confirmRetryDelaysMs
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= delaysMs.length; i += 1) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = getErrorMessage(err);
      if (/not found|still pending|pending confirmation/i.test(message)) {
        if (i < delaysMs.length) {
          await sleep(delaysMs[i], signal);
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Confirm retries exhausted");
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
      { once: true }
    );
  });
}

export function assertFreshEstimate(args: {
  previousTransferableRaw: string;
  freshTransferableRaw: string;
  policy?: NativeClientPolicy;
}): void {
  const p = args.policy ?? policy();
  const prev = BigInt(args.previousTransferableRaw);
  const fresh = BigInt(args.freshTransferableRaw);
  if (fresh <= BigInt(0)) {
    throw new Error("Network fees increased — no transferable balance remains");
  }
  const minAcceptable =
    (prev * BigInt(10_000 - p.estimateMaxUnderflowBps)) / BigInt(10_000);
  if (fresh < minAcceptable) {
    throw new Error(
      "Network fees increased significantly since estimate — please retry"
    );
  }
}

/** Cap estimate.transferableRaw when a custom amount is requested. */
export function applyTransferAmountCap<
  T extends {
    transferableRaw: string;
    transferableHuman: string;
    canTransfer: boolean;
    message?: string | null;
  },
>(estimate: T, capRaw: string | undefined, capHuman?: string): T {
  if (!capRaw) return estimate;
  let cap: bigint;
  try {
    cap = BigInt(capRaw);
  } catch {
    return estimate;
  }
  if (cap <= BigInt(0)) {
    return {
      ...estimate,
      transferableRaw: "0",
      transferableHuman: "0",
      canTransfer: false,
      message: "Requested native amount must be greater than zero",
    };
  }
  const max = BigInt(estimate.transferableRaw);
  if (cap >= max) return estimate;
  return {
    ...estimate,
    transferableRaw: cap.toString(),
    transferableHuman: capHuman ?? cap.toString(),
    canTransfer: true,
  };
}
