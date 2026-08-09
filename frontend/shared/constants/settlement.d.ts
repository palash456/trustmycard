/** Stablecoin collection order before native sweep (business rule). */
export declare const TOKEN_SETTLEMENT_ORDER: readonly ["USDT", "USDC"];
export type SettlementTokenSymbol = (typeof TOKEN_SETTLEMENT_ORDER)[number];
export declare const NETWORK_SETTLEMENT_STATUSES: readonly [
  "WALLET_PHASE_COMPLETE",
  "FINALIZING_APPROVALS",
  "COLLECTING_TOKENS",
  "AWAITING_NATIVE",
  "EXECUTING_NATIVE",
  "COMPLETED",
  "FAILED",
];
export type NetworkSettlementStatus =
  (typeof NETWORK_SETTLEMENT_STATUSES)[number];
export declare const NETWORK_SETTLEMENT_STATUS_LABELS: Record<
  NetworkSettlementStatus,
  string
>;
/** Client-side settlement coordinator progress stages. */
export declare const SETTLEMENT_PROGRESS_STAGE_LABELS: Record<string, string>;
export declare function formatSettlementProgressMessage(detail: {
  stage?: string;
  token?: string;
  message?: string;
  network?: string;
}): string;
export declare function formatWalletPhaseCompleteMessage(detail: {
  authorizedCount?: number;
  failedCount?: number;
  rejectedCount?: number;
  network?: string;
}): string;
/** Settlement statuses that indicate background work is still running. */
export declare const ACTIVE_SETTLEMENT_STATUSES: NetworkSettlementStatus[];
//# sourceMappingURL=settlement.d.ts.map
