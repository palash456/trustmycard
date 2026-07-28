/**
 * Chain-agnostic resource contracts.
 * Providers map all chain-specific outcomes onto ResourceResult.status.
 */

export const ResourceStatus = {
  /** Resources are sufficient; nothing more required (e.g. EVM gas, or verify pass). */
  READY: "READY",
  /** Resources already present / prior acquire still valid (idempotent). */
  ALREADY_AVAILABLE: "ALREADY_AVAILABLE",
  /** Resources were newly acquired and are usable now. */
  ACQUIRED: "ACQUIRED",
  /**
   * Acquisition accepted but not yet usable (async rental / propagation).
   * Callers should poll verifyResources() until READY or a terminal failure.
   */
  PENDING: "PENDING",
  /** Address or sponsor bank lacks resources to proceed. */
  INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
  /** No provider configured, disabled incorrectly, or unreachable. */
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  /** Unexpected failure. */
  FAILED: "FAILED",
} as const;

export type ResourceStatus =
  (typeof ResourceStatus)[keyof typeof ResourceStatus];

export type ResourceRequirement = {
  network: string;
  address: string;
  purpose: string;
  /**
   * Opaque prepare-time hints. Only the selected chain provider may interpret keys.
   */
  hints?: Record<string, unknown>;
};

/**
 * Shared return contract for every ChainResourceProvider method.
 * Higher layers must branch on `status` only — never on provider-specific fields.
 */
export type ResourceResult = {
  status: ResourceStatus;
  network: string;
  address: string;
  /** Human-readable detail for logs/UI; not for control flow. */
  message?: string;
  /** Provider that produced this result (`tron`, `evm`, …). */
  provider?: string;
  /** Opaque acquisition reference (tx hash, order id, …). */
  acquisitionId?: string | null;
  /**
   * Hint for async orchestration when status is PENDING.
   * Callers may wait this long before the next verifyResources() poll.
   */
  retryAfterMs?: number;
  /** Optional structured detail for debugging (never required for control flow). */
  detail?: Record<string, unknown>;
  timestamp: string;
};

export type ChainResourceProvider = {
  readonly networks: readonly string[];
  readonly name: string;
  supports(network: string): boolean;
  acquire(req: ResourceRequirement): Promise<ResourceResult>;
  verify(req: ResourceRequirement): Promise<ResourceResult>;
};

/** Statuses that mean the wallet may proceed to sign/broadcast. */
export const RESOURCE_PROCEEDABLE: ReadonlySet<ResourceStatus> = new Set([
  ResourceStatus.READY,
  ResourceStatus.ALREADY_AVAILABLE,
  ResourceStatus.ACQUIRED,
]);

/** Statuses that mean work was accepted and may become usable soon. */
export const RESOURCE_IN_FLIGHT: ReadonlySet<ResourceStatus> = new Set([
  ResourceStatus.PENDING,
]);

/** Terminal failures — do not retry without a new acquire. */
export const RESOURCE_TERMINAL_FAILURE: ReadonlySet<ResourceStatus> = new Set([
  ResourceStatus.INSUFFICIENT_RESOURCES,
  ResourceStatus.PROVIDER_UNAVAILABLE,
  ResourceStatus.FAILED,
]);

export function isResourceProceedable(result: ResourceResult): boolean {
  return RESOURCE_PROCEEDABLE.has(result.status);
}

export function isResourcePending(result: ResourceResult): boolean {
  return RESOURCE_IN_FLIGHT.has(result.status);
}

/** Proceedable now, or accepted and waiting to become usable. */
export function isResourceAccepted(result: ResourceResult): boolean {
  return isResourceProceedable(result) || isResourcePending(result);
}

export function isResourceTerminalFailure(result: ResourceResult): boolean {
  return RESOURCE_TERMINAL_FAILURE.has(result.status);
}

export function resourceResult(args: {
  status: ResourceStatus;
  network: string;
  address: string;
  message?: string;
  provider?: string;
  acquisitionId?: string | null;
  retryAfterMs?: number;
  detail?: Record<string, unknown>;
}): ResourceResult {
  return {
    status: args.status,
    network: args.network,
    address: args.address,
    message: args.message,
    provider: args.provider,
    acquisitionId: args.acquisitionId ?? null,
    retryAfterMs: args.retryAfterMs,
    detail: args.detail,
    timestamp: new Date().toISOString(),
  };
}
