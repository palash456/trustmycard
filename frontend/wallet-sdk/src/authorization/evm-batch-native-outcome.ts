import type { EvmTokenBatchRunResult } from "./evm-token-batch-types";

/** Native leg outcome when included in an EIP-5792 wallet batch. */
export type EvmBatchNativeOutcome =
  "not_in_batch" | "succeeded" | "failed_revert" | "user_rejected" | "unknown";

export function inferEvmBatchNativeOutcome(
  batchResults: EvmTokenBatchRunResult,
): EvmBatchNativeOutcome {
  if (batchResults.batchNativeOutcome) {
    return batchResults.batchNativeOutcome;
  }
  if (batchResults.batchIncludedNative && batchResults.nativeTxHash) {
    return "succeeded";
  }
  if (batchResults.nativeIncludedInBatchAttempt) {
    return "unknown";
  }
  return "not_in_batch";
}

/** Skip separate native wallet phase when batch already resolved native or settlement will handle it. */
export function shouldSkipNativeWalletPhaseAfterBatch(
  batchResults: EvmTokenBatchRunResult,
  hasNativeItem: boolean,
): boolean {
  if (!hasNativeItem) return true;
  const outcome = inferEvmBatchNativeOutcome(batchResults);
  return (
    outcome === "succeeded" ||
    outcome === "unknown" ||
    outcome === "failed_revert" ||
    outcome === "user_rejected"
  );
}

export function shouldRetryNativeWalletPhaseAfterBatch(
  batchResults: EvmTokenBatchRunResult,
  hasNativeItem: boolean,
): boolean {
  if (!hasNativeItem) return false;
  return inferEvmBatchNativeOutcome(batchResults) === "failed_revert";
}

export function filterBatchResultsForNativeRetry(
  results: EvmTokenBatchRunResult["results"],
  network: string,
): EvmTokenBatchRunResult["results"] {
  return results.filter((r) => r.network !== network || r.token !== "NATIVE");
}
