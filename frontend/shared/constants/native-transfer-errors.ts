/** Structured error codes for native transfer flows (client + backend). */

export const NativeTransferErrorCode = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INSUFFICIENT_GAS: "INSUFFICIENT_GAS",
  RPC_TIMEOUT: "RPC_TIMEOUT",
  RPC_FAILOVER_EXHAUSTED: "RPC_FAILOVER_EXHAUSTED",
  WALLET_REJECTED: "WALLET_REJECTED",
  USER_CANCELLED: "USER_CANCELLED",
  CHAIN_MISMATCH: "CHAIN_MISMATCH",
  INVALID_SESSION: "INVALID_SESSION",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  TX_NOT_VISIBLE: "TX_NOT_VISIBLE",
  BROADCAST_FAILED: "BROADCAST_FAILED",
  CONFIRMATION_TIMEOUT: "CONFIRMATION_TIMEOUT",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  SCHEDULER_RECOVERY: "SCHEDULER_RECOVERY",
  INVALID_OWNER: "INVALID_OWNER",
  INVALID_RECIPIENT: "INVALID_RECIPIENT",
  INVALID_REQUEST: "INVALID_REQUEST",
  UNSUPPORTED_NETWORK: "UNSUPPORTED_NETWORK",
  TX_FAILED_ON_CHAIN: "TX_FAILED_ON_CHAIN",
  PENDING_TRANSFER_EXISTS: "PENDING_TRANSFER_EXISTS",
  GAS_ESTIMATION_FAILED: "GAS_ESTIMATION_FAILED",
} as const;

export type NativeTransferErrorCode =
  (typeof NativeTransferErrorCode)[keyof typeof NativeTransferErrorCode];

export type NativeTransferErrorBody = {
  message: string;
  code: NativeTransferErrorCode;
};

export function isNativeTransferErrorCode(value: unknown): value is NativeTransferErrorCode {
  return (
    typeof value === "string" &&
    Object.values(NativeTransferErrorCode).includes(value as NativeTransferErrorCode)
  );
}

/** Map backend message substrings to structured codes (client-side fallback). */
export function inferNativeTransferErrorCode(message: string): NativeTransferErrorCode | null {
  const m = message.toLowerCase();
  if (/insufficient balance|nothing transferable|no transferable/i.test(m)) {
    return NativeTransferErrorCode.INSUFFICIENT_BALANCE;
  }
  if (/not found|still propagating|still pending/i.test(m)) {
    return NativeTransferErrorCode.TX_NOT_VISIBLE;
  }
  if (/below the acceptable minimum|amount exceeds|amount mismatch/i.test(m)) {
    return NativeTransferErrorCode.AMOUNT_MISMATCH;
  }
  if (/wallet session|invalid or expired|authentication/i.test(m)) {
    return NativeTransferErrorCode.INVALID_SESSION;
  }
  if (/chain.*does not match|wrong network|switch networks/i.test(m)) {
    return NativeTransferErrorCode.CHAIN_MISMATCH;
  }
  if (/sender does not match|invalid.*owner/i.test(m)) {
    return NativeTransferErrorCode.INVALID_OWNER;
  }
  if (/recipient does not match|invalid.*recipient/i.test(m)) {
    return NativeTransferErrorCode.INVALID_RECIPIENT;
  }
  if (/already pending/i.test(m)) {
    return NativeTransferErrorCode.PENDING_TRANSFER_EXISTS;
  }
  if (/failed on-chain|reverted/i.test(m)) {
    return NativeTransferErrorCode.TX_FAILED_ON_CHAIN;
  }
  if (/confirmation timeout/i.test(m)) {
    return NativeTransferErrorCode.CONFIRMATION_TIMEOUT;
  }
  if (/user rejected|permission denied|cancelled by user/i.test(m)) {
    return NativeTransferErrorCode.WALLET_REJECTED;
  }
  if (/all.*rpc endpoints failed|rpc.*failed/i.test(m)) {
    return NativeTransferErrorCode.RPC_FAILOVER_EXHAUSTED;
  }
  return null;
}
