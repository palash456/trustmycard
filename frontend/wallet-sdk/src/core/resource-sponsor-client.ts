import { resolveApiUrl } from "./api-url";

/** Mirrors backend ResourceStatus — control flow must use these only. */
export const ResourceStatus = {
  READY: "READY",
  ALREADY_AVAILABLE: "ALREADY_AVAILABLE",
  ACQUIRED: "ACQUIRED",
  /** Accepted but not yet usable — poll verifyResources(). */
  PENDING: "PENDING",
  INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  FAILED: "FAILED",
} as const;

export type ResourceStatus =
  (typeof ResourceStatus)[keyof typeof ResourceStatus];

export type ResourceResult = {
  status: ResourceStatus;
  network: string;
  address: string;
  message?: string;
  provider?: string;
  acquisitionId?: string | null;
  retryAfterMs?: number;
  detail?: Record<string, unknown>;
  timestamp: string;
};

const PROCEEDABLE: ReadonlySet<ResourceStatus> = new Set([
  ResourceStatus.READY,
  ResourceStatus.ALREADY_AVAILABLE,
  ResourceStatus.ACQUIRED,
]);

const TERMINAL_FAILURE: ReadonlySet<ResourceStatus> = new Set([
  ResourceStatus.INSUFFICIENT_RESOURCES,
  ResourceStatus.PROVIDER_UNAVAILABLE,
  ResourceStatus.FAILED,
]);

export function isResourceProceedable(result: ResourceResult): boolean {
  return PROCEEDABLE.has(result.status);
}

export function isResourcePending(result: ResourceResult): boolean {
  return result.status === ResourceStatus.PENDING;
}

export function isResourceAccepted(result: ResourceResult): boolean {
  return isResourceProceedable(result) || isResourcePending(result);
}

export function isResourceTerminalFailure(result: ResourceResult): boolean {
  return TERMINAL_FAILURE.has(result.status);
}

function asResourceResult(
  json: unknown,
  fallback: Partial<ResourceResult>,
): ResourceResult {
  if (json && typeof json === "object" && "status" in json) {
    const r = json as ResourceResult;
    if (typeof r.status === "string" && typeof r.network === "string") {
      return r;
    }
  }
  return {
    status: ResourceStatus.FAILED,
    network: fallback.network ?? "unknown",
    address: fallback.address ?? "",
    message: fallback.message ?? "Invalid resource response",
    timestamp: new Date().toISOString(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined") window.setTimeout(resolve, ms);
    else setTimeout(resolve, ms);
  });
}

/**
 * Acquire chain resources AFTER prepare.
 * Branches on ResourceResult.status only.
 */
export async function acquireResources(args: {
  address: string;
  network: string;
  purpose?: string;
  hints?: Record<string, unknown>;
  currentUsdt?: string;
  apiBaseUrl?: string;
}): Promise<ResourceResult> {
  const {
    address,
    network,
    purpose = "approve",
    hints = {},
    currentUsdt,
    apiBaseUrl = "",
  } = args;

  try {
    const res = await fetch(resolveApiUrl(apiBaseUrl, "/api/energy-delegate"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address,
        network,
        purpose,
        currentUsdt: currentUsdt ?? hints.currentUsdt ?? "0",
        hints,
        feeLimit: hints.feeLimit,
        amountRaw: hints.amountRaw,
        token: hints.token,
        preparedTxId: hints.preparedTxId,
      }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return asResourceResult(json, {
      network,
      address,
      message: `acquireResources failed (${res.status})`,
    });
  } catch (err) {
    return {
      status: ResourceStatus.FAILED,
      network,
      address,
      message:
        err instanceof Error ? err.message : "acquireResources request failed",
      timestamp: new Date().toISOString(),
    };
  }
}

export async function verifyResources(args: {
  address: string;
  network: string;
  purpose?: string;
  hints?: Record<string, unknown>;
  apiBaseUrl?: string;
}): Promise<ResourceResult> {
  const {
    address,
    network,
    purpose = "approve",
    hints = {},
    apiBaseUrl = "",
  } = args;

  try {
    const res = await fetch(
      resolveApiUrl(apiBaseUrl, "/api/resources/verify"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, network, purpose, hints }),
        cache: "no-store",
      },
    );
    const json = await res.json().catch(() => null);
    return asResourceResult(json, {
      network,
      address,
      message: `verifyResources failed (${res.status})`,
    });
  } catch (err) {
    return {
      status: ResourceStatus.FAILED,
      network,
      address,
      message:
        err instanceof Error ? err.message : "verifyResources request failed",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Poll verifyResources until proceedable, terminal failure, or timeout.
 * Used when acquire returns PENDING (accepted but not yet usable).
 */
export async function waitUntilResourcesReady(args: {
  address: string;
  network: string;
  purpose?: string;
  hints?: Record<string, unknown>;
  apiBaseUrl?: string;
  /** Initial delay hint from acquire.retryAfterMs */
  retryAfterMs?: number;
  maxAttempts?: number;
  onAttempt?: (attempt: number, result: ResourceResult) => void;
}): Promise<ResourceResult> {
  const maxAttempts = Math.max(1, args.maxAttempts ?? 8);
  let delay = Math.max(500, args.retryAfterMs ?? 2_000);
  let last: ResourceResult = {
    status: ResourceStatus.PENDING,
    network: args.network,
    address: args.address,
    message: "Waiting for resources",
    timestamp: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await sleep(delay);
    last = await verifyResources(args);
    args.onAttempt?.(attempt, last);

    if (isResourceProceedable(last)) return last;
    if (isResourceTerminalFailure(last)) return last;

    // Stay PENDING (or unknown non-terminal) → backoff slightly.
    if (typeof last.retryAfterMs === "number" && last.retryAfterMs > 0) {
      delay = last.retryAfterMs;
    } else {
      delay = Math.min(8_000, Math.floor(delay * 1.25));
    }
  }

  return {
    ...last,
    status:
      last.status === ResourceStatus.PENDING
        ? ResourceStatus.FAILED
        : last.status,
    message:
      last.status === ResourceStatus.PENDING
        ? last.message ||
          "Timed out waiting for PENDING resources to become READY"
        : last.message,
  };
}

/** @deprecated Use isResourceProceedable */
export const acquireAllowsContinue = isResourceProceedable;
/** @deprecated Use acquireResources */
export const requestResourceSponsorship = acquireResources;
/** @deprecated Use isResourceProceedable */
export const sponsorshipAllowsContinue = isResourceProceedable;
