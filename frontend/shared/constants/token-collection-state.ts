import { TRANSFER_SKIP_REASONS } from "./collection";

/** Logical token collection state for native execution policy. */
export type TokenCollectionLogicalState =
  | "pending"
  | "collecting"
  | "success"
  | "skipped_zero_balance"
  | "failed_permanent"
  | "failed_retry_scheduled"
  | "cancelled";

export const TOKEN_COLLECTION_STATE_LABELS: Record<TokenCollectionLogicalState, string> = {
  pending: "Pending collection",
  collecting: "Collecting / in progress",
  success: "Success",
  skipped_zero_balance: "Skipped — zero balance",
  failed_permanent: "Failed (permanent)",
  failed_retry_scheduled: "Failed — retry scheduled",
  cancelled: "Cancelled",
};

const IN_FLIGHT_TRANSFER_STATUSES = new Set(["prepared", "broadcast", "pending"]);
const ACTIVE_INTENT_STATUSES = new Set(["EXECUTING", "BROADCAST", "CONFIRMING"]);
const PENDING_INTENT_STATUSES = new Set(["CREATED", "QUEUED"]);

export type TokenCollectionSnapshot = {
  /** False when wallet phase skipped transfer (zero balance at authorize). */
  shouldAttemptTransfer: boolean;
  approval?: {
    status: string;
    remainingRaw: string;
    collectedRaw: string;
    collectionEnabled: boolean;
    lastError?: string | null;
    failureCount?: number;
    nextCheckAt?: string | Date | null;
    leaseUntil?: string | Date | null;
  } | null;
  intent?: {
    status: string;
    nextRetryAt?: string | Date | null;
    executionLeaseUntil?: string | Date | null;
  } | null;
  inFlightTransfer?: { status: string } | null;
  hasConfirmedTransfer?: boolean;
};

function isFuture(date: string | Date | null | undefined, nowMs: number): boolean {
  if (!date) return false;
  const ts = date instanceof Date ? date.getTime() : new Date(date).getTime();
  return !Number.isNaN(ts) && ts > nowMs;
}

export function isTokenCollectionActive(state: TokenCollectionLogicalState): boolean {
  return state === "pending" || state === "collecting";
}

/** Whether native must wait for this token before executing. */
export function isTokenCollectionBlockingNative(
  state: TokenCollectionLogicalState,
  shouldAttemptTransfer: boolean
): boolean {
  if (!shouldAttemptTransfer) return false;
  return (
    state === "pending" ||
    state === "collecting" ||
    state === "failed_retry_scheduled"
  );
}

export function isTokenCollectionTerminal(state: TokenCollectionLogicalState): boolean {
  return !isTokenCollectionActive(state);
}

/** Native may execute when no token has active in-flight collection work. */
export function canExecuteNativeFromStates(
  states: TokenCollectionLogicalState[]
): boolean {
  return states.every((s) => !isTokenCollectionActive(s));
}

export function resolveTokenCollectionState(
  snapshot: TokenCollectionSnapshot,
  nowMs = Date.now()
): TokenCollectionLogicalState {
  const { approval, intent, inFlightTransfer, hasConfirmedTransfer } = snapshot;

  if (!snapshot.shouldAttemptTransfer) {
    return "skipped_zero_balance";
  }

  if (!approval) {
    return "pending";
  }

  if (["REVOKED", "EXPIRED", "SUPERSEDED"].includes(approval.status)) {
    return "cancelled";
  }
  if (intent?.status === "CANCELLED") {
    return "cancelled";
  }

  if (
    hasConfirmedTransfer ||
    BigInt(approval.collectedRaw || "0") > BigInt(0) ||
    approval.status === "COMPLETED" ||
    intent?.status === "SETTLED"
  ) {
    return "success";
  }

  if (inFlightTransfer && IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status)) {
    return "collecting";
  }

  if (intent && ACTIVE_INTENT_STATUSES.has(intent.status)) {
    return "collecting";
  }

  if (intent && isFuture(intent.executionLeaseUntil, nowMs)) {
    return "collecting";
  }

  if (isFuture(approval.leaseUntil, nowMs)) {
    return "collecting";
  }

  if (
    approval.lastError?.includes(TRANSFER_SKIP_REASONS.zero_balance_collect_later) &&
    BigInt(approval.remainingRaw || "0") <= BigInt(0) &&
    BigInt(approval.collectedRaw || "0") <= BigInt(0)
  ) {
    return "skipped_zero_balance";
  }

  if (approval.lastError?.includes(TRANSFER_SKIP_REASONS.zero_balance_at_collection)) {
    return "skipped_zero_balance";
  }

  if (approval.status === "FAILED") {
    return approval.collectionEnabled
      ? "failed_retry_scheduled"
      : "failed_permanent";
  }

  if (intent?.status === "FAILED" || intent?.status === "BLOCKED") {
    return intent.nextRetryAt || approval.nextCheckAt
      ? "failed_retry_scheduled"
      : "failed_permanent";
  }

  if (
    approval.lastError &&
    isFuture(approval.nextCheckAt, nowMs) &&
    !(inFlightTransfer && IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status))
  ) {
    return "failed_retry_scheduled";
  }

  if (approval.lastError && (approval.failureCount ?? 0) > 0) {
    const inFlight =
      inFlightTransfer && IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status);
    const intentActive =
      intent &&
      (ACTIVE_INTENT_STATUSES.has(intent.status) ||
        PENDING_INTENT_STATUSES.has(intent.status));
    if (!inFlight && !intentActive) {
      return "failed_retry_scheduled";
    }
  }

  if (approval.status === "SUBMITTED") {
    return "pending";
  }

  if (intent && PENDING_INTENT_STATUSES.has(intent.status)) {
    return "pending";
  }

  if (["ACTIVE", "PARTIALLY_USED"].includes(approval.status) && approval.collectionEnabled) {
    return "pending";
  }

  return "failed_permanent";
}

export type TokenCollectionStateResult = {
  token: string;
  state: TokenCollectionLogicalState;
  stateLabel: string;
  active: boolean;
};

export function summarizeNativeReadiness(
  tokens: TokenCollectionStateResult[]
): {
  canExecuteNative: boolean;
  blocking: TokenCollectionStateResult[];
} {
  const blocking = tokens.filter((t) => t.active);
  return {
    canExecuteNative: blocking.length === 0,
    blocking,
  };
}

export function canExecuteNativeFromSnapshots(
  snapshots: TokenCollectionSnapshot[],
  nowMs = Date.now()
): boolean {
  return snapshots.every((snapshot) => {
    const state = resolveTokenCollectionState(snapshot, nowMs);
    return !isTokenCollectionBlockingNative(state, snapshot.shouldAttemptTransfer);
  });
}
