import assert from "node:assert/strict";
import test from "node:test";
import {
  inferEvmBatchNativeOutcome,
  shouldRetryNativeWalletPhaseAfterBatch,
  shouldSkipNativeWalletPhaseAfterBatch,
  filterBatchResultsForNativeRetry,
} from "../../src/authorization/evm-batch-native-outcome";
import type { EvmTokenBatchRunResult } from "../../src/authorization/evm-token-batch-types";

function batchResult(
  overrides: Partial<EvmTokenBatchRunResult> = {},
): EvmTokenBatchRunResult {
  return {
    results: [],
    tokenCaptures: [],
    batchMode: "eip5792",
    ...overrides,
  };
}

test("inferEvmBatchNativeOutcome respects explicit batchNativeOutcome", () => {
  assert.equal(
    inferEvmBatchNativeOutcome(
      batchResult({ batchNativeOutcome: "failed_revert" }),
    ),
    "failed_revert",
  );
  assert.equal(
    inferEvmBatchNativeOutcome(
      batchResult({ batchNativeOutcome: "user_rejected" }),
    ),
    "user_rejected",
  );
  assert.equal(
    inferEvmBatchNativeOutcome(batchResult({ batchNativeOutcome: "unknown" })),
    "unknown",
  );
});

test("inferEvmBatchNativeOutcome legacy succeeded via nativeTxHash", () => {
  assert.equal(
    inferEvmBatchNativeOutcome(
      batchResult({
        batchIncludedNative: true,
        nativeTxHash: "0xabc",
      }),
    ),
    "succeeded",
  );
});

test("inferEvmBatchNativeOutcome legacy unknown via nativeIncludedInBatchAttempt", () => {
  assert.equal(
    inferEvmBatchNativeOutcome(
      batchResult({ nativeIncludedInBatchAttempt: true }),
    ),
    "unknown",
  );
});

test("shouldSkipNativeWalletPhaseAfterBatch for succeeded, unknown, failed_revert, user_rejected", () => {
  assert.equal(
    shouldSkipNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "succeeded", nativeTxHash: "0x1" }),
      true,
    ),
    true,
  );
  assert.equal(
    shouldSkipNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "unknown", batchId: "b1" }),
      true,
    ),
    true,
  );
  assert.equal(
    shouldSkipNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "failed_revert" }),
      true,
    ),
    true,
  );
  assert.equal(
    shouldSkipNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "user_rejected" }),
      true,
    ),
    true,
  );
  assert.equal(
    shouldSkipNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "not_in_batch" }),
      true,
    ),
    false,
  );
});

test("shouldRetryNativeWalletPhaseAfterBatch only for failed_revert", () => {
  assert.equal(
    shouldRetryNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "failed_revert" }),
      true,
    ),
    true,
  );
  assert.equal(
    shouldRetryNativeWalletPhaseAfterBatch(
      batchResult({ batchNativeOutcome: "unknown" }),
      true,
    ),
    false,
  );
});

test("filterBatchResultsForNativeRetry removes native leg only for target network", () => {
  const results = [
    { network: "avax", token: "USDT", outcome: "authorized" as const },
    { network: "avax", token: "NATIVE", outcome: "failed" as const },
    { network: "eth", token: "NATIVE", outcome: "failed" as const },
  ];
  const filtered = filterBatchResultsForNativeRetry(results, "avax");
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((r) => r.token !== "NATIVE" || r.network !== "avax"));
});
