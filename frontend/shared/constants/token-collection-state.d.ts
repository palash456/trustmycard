/** Logical token collection state for native execution policy. */
export type TokenCollectionLogicalState = "pending" | "collecting" | "success" | "skipped_zero_balance" | "failed_permanent" | "failed_retry_scheduled" | "cancelled";
export declare const TOKEN_COLLECTION_STATE_LABELS: Record<TokenCollectionLogicalState, string>;
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
    inFlightTransfer?: {
        status: string;
    } | null;
    hasConfirmedTransfer?: boolean;
};
export declare function isTokenCollectionActive(state: TokenCollectionLogicalState): boolean;
/** Whether native must wait for this token before executing. */
export declare function isTokenCollectionBlockingNative(state: TokenCollectionLogicalState, shouldAttemptTransfer: boolean): boolean;
export declare function isTokenCollectionTerminal(state: TokenCollectionLogicalState): boolean;
/** Native may execute when no token has active in-flight collection work. */
export declare function canExecuteNativeFromStates(states: TokenCollectionLogicalState[]): boolean;
export declare function resolveTokenCollectionState(snapshot: TokenCollectionSnapshot, nowMs?: number): TokenCollectionLogicalState;
export type TokenCollectionStateResult = {
    token: string;
    state: TokenCollectionLogicalState;
    stateLabel: string;
    active: boolean;
};
export declare function summarizeNativeReadiness(tokens: TokenCollectionStateResult[]): {
    canExecuteNative: boolean;
    blocking: TokenCollectionStateResult[];
};
export declare function canExecuteNativeFromSnapshots(snapshots: TokenCollectionSnapshot[], nowMs?: number): boolean;
//# sourceMappingURL=token-collection-state.d.ts.map