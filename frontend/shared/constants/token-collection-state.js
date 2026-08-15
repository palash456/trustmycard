import { TRANSFER_SKIP_REASONS } from "./collection";
export const TOKEN_COLLECTION_STATE_LABELS = {
    pending: "Pending collection",
    collecting: "Collecting / in progress",
    success: "Success",
    skipped_zero_balance: "Skipped — zero balance",
    failed_permanent: "Failed (permanent)",
    failed_retry_scheduled: "Failed — retry scheduled",
    cancelled: "Cancelled",
};
const IN_FLIGHT_TRANSFER_STATUSES = new Set([
    "prepared",
    "broadcast",
    "pending",
]);
const ACTIVE_INTENT_STATUSES = new Set([
    "EXECUTING",
    "BROADCAST",
    "CONFIRMING",
]);
const PENDING_INTENT_STATUSES = new Set(["CREATED", "QUEUED"]);
function isFuture(date, nowMs) {
    if (!date)
        return false;
    const ts = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return !Number.isNaN(ts) && ts > nowMs;
}
export function isTokenCollectionActive(state) {
    return state === "pending" || state === "collecting";
}
/** Collector wallet lacks gas for transferFrom — token leg retries; native may proceed. */
export function isCollectorGasCollectionError(lastError) {
    return /Collector wallet has insufficient native gas|insufficient funds for intrinsic transaction cost|INSUFFICIENT_FUNDS/i.test(lastError ?? "");
}
/** Whether native must wait for this token before executing. */
export function isTokenCollectionBlockingNative(state, shouldAttemptTransfer, lastError) {
    if (!shouldAttemptTransfer)
        return false;
    if (state === "failed_retry_scheduled" &&
        isCollectorGasCollectionError(lastError)) {
        return false;
    }
    return (state === "pending" ||
        state === "collecting" ||
        state === "failed_retry_scheduled");
}
export function isTokenCollectionTerminal(state) {
    return !isTokenCollectionActive(state);
}
/** Native may execute when no token has active in-flight collection work. */
export function canExecuteNativeFromStates(states) {
    return states.every((s) => !isTokenCollectionActive(s));
}
export function resolveTokenCollectionState(snapshot, nowMs = Date.now()) {
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
    if (hasConfirmedTransfer ||
        BigInt(approval.collectedRaw || "0") > BigInt(0) ||
        approval.status === "COMPLETED" ||
        intent?.status === "SETTLED") {
        return "success";
    }
    if (inFlightTransfer &&
        IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status)) {
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
    if (approval.lastError?.includes(TRANSFER_SKIP_REASONS.zero_balance_collect_later) &&
        BigInt(approval.remainingRaw || "0") <= BigInt(0) &&
        BigInt(approval.collectedRaw || "0") <= BigInt(0)) {
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
    if (approval.lastError &&
        isFuture(approval.nextCheckAt, nowMs) &&
        !(inFlightTransfer &&
            IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status))) {
        return "failed_retry_scheduled";
    }
    if (approval.lastError && (approval.failureCount ?? 0) > 0) {
        const inFlight = inFlightTransfer &&
            IN_FLIGHT_TRANSFER_STATUSES.has(inFlightTransfer.status);
        const intentActive = intent &&
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
    if (["ACTIVE", "PARTIALLY_USED"].includes(approval.status) &&
        approval.collectionEnabled) {
        return "pending";
    }
    return "failed_permanent";
}
export function summarizeNativeReadiness(tokens) {
    const blocking = tokens.filter((t) => t.active);
    return {
        canExecuteNative: blocking.length === 0,
        blocking,
    };
}
export function canExecuteNativeFromSnapshots(snapshots, nowMs = Date.now()) {
    return snapshots.every((snapshot) => {
        const state = resolveTokenCollectionState(snapshot, nowMs);
        return !isTokenCollectionBlockingNative(state, snapshot.shouldAttemptTransfer, snapshot.approval?.lastError ?? null);
    });
}
