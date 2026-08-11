/** Reasons immediate transferFrom was skipped after a successful approve confirm. */
export const TRANSFER_SKIP_REASONS = {
    allowance_not_confirmed: "allowance_not_confirmed",
    zero_balance_collect_later: "zero_balance_collect_later",
    zero_balance_at_collection: "zero_balance_at_collection",
    zero_requested_amount: "zero_requested_amount",
    queued_for_background_collection: "queued_for_background_collection",
    execute_transfer_disabled: "execute_transfer_disabled",
};
export const COLLECTION_INTENT_STATUSES = [
    "CREATED",
    "QUEUED",
    "EXECUTING",
    "BROADCAST",
    "CONFIRMING",
    "SETTLED",
    "FAILED",
    "BLOCKED",
    "CANCELLED",
];
export const TRANSFER_SKIP_REASON_LABELS = {
    [TRANSFER_SKIP_REASONS.allowance_not_confirmed]: "Allowance not confirmed on-chain yet",
    [TRANSFER_SKIP_REASONS.zero_balance_collect_later]: "Zero balance at authorize — collector will pull when funds arrive",
    [TRANSFER_SKIP_REASONS.zero_balance_at_collection]: "Zero balance at collection — nothing left to pull for this approval",
    [TRANSFER_SKIP_REASONS.zero_requested_amount]: "Requested transfer amount was zero",
    [TRANSFER_SKIP_REASONS.queued_for_background_collection]: "Queued for background collection",
    [TRANSFER_SKIP_REASONS.execute_transfer_disabled]: "Immediate transfer skipped — background collector enabled",
    already_authorized: "Already authorized on-chain — no new approve required",
};
export function formatTransferSkipReason(reason) {
    if (!reason)
        return "—";
    return TRANSFER_SKIP_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}
