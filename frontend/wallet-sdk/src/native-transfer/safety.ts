const NATIVE_TRANSFER_LOCK_KEY = "tmw-native-transfer-in-flight";
const LOCK_TTL_MS = 120_000;

export function acquireNativeTransferLock(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const existing = sessionStorage.getItem(NATIVE_TRANSFER_LOCK_KEY);
  if (existing) {
    const started = Number.parseInt(existing, 10);
    if (Number.isFinite(started) && Date.now() - started < LOCK_TTL_MS) {
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

const CONFIRM_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

export async function retryConfirmWithBackoff<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= CONFIRM_RETRY_DELAYS_MS.length; i += 1) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (/not found|still pending|pending confirmation/i.test(message)) {
        if (i < CONFIRM_RETRY_DELAYS_MS.length) {
          await sleep(CONFIRM_RETRY_DELAYS_MS[i], signal);
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

/** Reject if fresh estimate dropped more than 2% (gas spike / stale quote). */
export function assertFreshEstimate(args: {
  previousTransferableRaw: string;
  freshTransferableRaw: string;
}): void {
  const prev = BigInt(args.previousTransferableRaw);
  const fresh = BigInt(args.freshTransferableRaw);
  if (fresh <= BigInt(0)) {
    throw new Error("Network fees increased — no transferable balance remains");
  }
  const minAcceptable = (prev * BigInt(9800)) / BigInt(10_000);
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
