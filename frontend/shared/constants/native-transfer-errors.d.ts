/** Structured error codes for native transfer flows (client + backend). */
export declare const NativeTransferErrorCode: {
  readonly INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE";
  readonly INSUFFICIENT_GAS: "INSUFFICIENT_GAS";
  readonly RPC_TIMEOUT: "RPC_TIMEOUT";
  readonly RPC_FAILOVER_EXHAUSTED: "RPC_FAILOVER_EXHAUSTED";
  readonly WALLET_REJECTED: "WALLET_REJECTED";
  readonly USER_CANCELLED: "USER_CANCELLED";
  readonly CHAIN_MISMATCH: "CHAIN_MISMATCH";
  readonly INVALID_SESSION: "INVALID_SESSION";
  readonly SESSION_EXPIRED: "SESSION_EXPIRED";
  readonly TX_NOT_VISIBLE: "TX_NOT_VISIBLE";
  readonly BROADCAST_FAILED: "BROADCAST_FAILED";
  readonly CONFIRMATION_TIMEOUT: "CONFIRMATION_TIMEOUT";
  readonly AMOUNT_MISMATCH: "AMOUNT_MISMATCH";
  readonly SCHEDULER_RECOVERY: "SCHEDULER_RECOVERY";
  readonly INVALID_OWNER: "INVALID_OWNER";
  readonly INVALID_RECIPIENT: "INVALID_RECIPIENT";
  readonly INVALID_REQUEST: "INVALID_REQUEST";
  readonly UNSUPPORTED_NETWORK: "UNSUPPORTED_NETWORK";
  readonly TX_FAILED_ON_CHAIN: "TX_FAILED_ON_CHAIN";
  readonly PENDING_TRANSFER_EXISTS: "PENDING_TRANSFER_EXISTS";
  readonly GAS_ESTIMATION_FAILED: "GAS_ESTIMATION_FAILED";
};
export type NativeTransferErrorCode =
  (typeof NativeTransferErrorCode)[keyof typeof NativeTransferErrorCode];
export type NativeTransferErrorBody = {
  message: string;
  code: NativeTransferErrorCode;
};
export declare function isNativeTransferErrorCode(
  value: unknown,
): value is NativeTransferErrorCode;
/** Map backend message substrings to structured codes (client-side fallback). */
export declare function inferNativeTransferErrorCode(
  message: string,
): NativeTransferErrorCode | null;
//# sourceMappingURL=native-transfer-errors.d.ts.map
