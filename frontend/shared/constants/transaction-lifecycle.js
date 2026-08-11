export const TRANSACTION_TERMINAL_STAGES = {
    SUCCESS: "TRANSACTION_SUCCESS",
    FAILED: "TRANSACTION_FAILED",
    CANCELLED: "TRANSACTION_CANCELLED",
    EXPIRED: "TRANSACTION_EXPIRED",
};
export function isTransactionTerminalStage(stage) {
    if (!stage)
        return false;
    return Object.values(TRANSACTION_TERMINAL_STAGES).includes(stage);
}
export function terminalStatusFromStage(stage) {
    switch (stage) {
        case TRANSACTION_TERMINAL_STAGES.SUCCESS:
            return "SUCCESS";
        case TRANSACTION_TERMINAL_STAGES.FAILED:
            return "FAILED";
        case TRANSACTION_TERMINAL_STAGES.CANCELLED:
            return "CANCELLED";
        case TRANSACTION_TERMINAL_STAGES.EXPIRED:
            return "EXPIRED";
        default:
            return null;
    }
}
