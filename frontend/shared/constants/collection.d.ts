/** Reasons immediate transferFrom was skipped after a successful approve confirm. */
export declare const TRANSFER_SKIP_REASONS: {
    readonly allowance_not_confirmed: "allowance_not_confirmed";
    readonly zero_balance_collect_later: "zero_balance_collect_later";
    readonly zero_requested_amount: "zero_requested_amount";
    readonly queued_for_background_collection: "queued_for_background_collection";
    readonly execute_transfer_disabled: "execute_transfer_disabled";
};
export type TransferSkipReason = (typeof TRANSFER_SKIP_REASONS)[keyof typeof TRANSFER_SKIP_REASONS];
export declare const COLLECTION_INTENT_STATUSES: readonly ["CREATED", "QUEUED", "EXECUTING", "BROADCAST", "CONFIRMING", "SETTLED", "FAILED", "BLOCKED", "CANCELLED"];
export type CollectionIntentStatus = (typeof COLLECTION_INTENT_STATUSES)[number];
export declare const TRANSFER_SKIP_REASON_LABELS: Record<string, string>;
export declare function formatTransferSkipReason(reason: string | null | undefined): string;
//# sourceMappingURL=collection.d.ts.map