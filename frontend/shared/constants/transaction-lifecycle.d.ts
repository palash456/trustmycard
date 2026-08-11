/** Terminal outcome for one user transaction attempt (journey). */
export type TransactionTerminalStatus = "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | "IN_PROGRESS";
export declare const TRANSACTION_TERMINAL_STAGES: {
    readonly SUCCESS: "TRANSACTION_SUCCESS";
    readonly FAILED: "TRANSACTION_FAILED";
    readonly CANCELLED: "TRANSACTION_CANCELLED";
    readonly EXPIRED: "TRANSACTION_EXPIRED";
};
export type TransactionTerminalStage = (typeof TRANSACTION_TERMINAL_STAGES)[keyof typeof TRANSACTION_TERMINAL_STAGES];
export declare function isTransactionTerminalStage(stage: string | null | undefined): stage is TransactionTerminalStage;
export declare function terminalStatusFromStage(stage: string): TransactionTerminalStatus | null;
//# sourceMappingURL=transaction-lifecycle.d.ts.map