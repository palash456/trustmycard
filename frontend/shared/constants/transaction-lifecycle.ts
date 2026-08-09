/** Terminal outcome for one user transaction attempt (journey). */
export type TransactionTerminalStatus =
  "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | "IN_PROGRESS";

export const TRANSACTION_TERMINAL_STAGES = {
  SUCCESS: "TRANSACTION_SUCCESS",
  FAILED: "TRANSACTION_FAILED",
  CANCELLED: "TRANSACTION_CANCELLED",
  EXPIRED: "TRANSACTION_EXPIRED",
} as const;

export type TransactionTerminalStage =
  (typeof TRANSACTION_TERMINAL_STAGES)[keyof typeof TRANSACTION_TERMINAL_STAGES];

export function isTransactionTerminalStage(
  stage: string | null | undefined,
): stage is TransactionTerminalStage {
  if (!stage) return false;
  return Object.values(TRANSACTION_TERMINAL_STAGES).includes(
    stage as TransactionTerminalStage,
  );
}

export function terminalStatusFromStage(
  stage: string,
): TransactionTerminalStatus | null {
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
