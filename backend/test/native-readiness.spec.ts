import assert from "node:assert/strict";
import test from "node:test";
import {
  isTokenCollectionBlockingNative,
  resolveTokenCollectionState,
  summarizeNativeReadiness,
  TOKEN_COLLECTION_STATE_LABELS,
} from "@trustmycard/shared/constants/token-collection-state";

const NOW = Date.parse("2026-08-05T12:00:00.000Z");
const FUTURE = new Date(NOW + 60_000).toISOString();

function evaluateFromSnapshots(
  snapshots: Array<{
    snapshot: Parameters<typeof resolveTokenCollectionState>[0];
    shouldAttemptTransfer: boolean;
  }>
) {
  const tokens = snapshots.map(({ snapshot, shouldAttemptTransfer }, i) => {
    const state = resolveTokenCollectionState(snapshot, NOW);
    return {
      token: ["USDT", "USDC"][i] ?? `T${i}`,
      state,
      stateLabel: TOKEN_COLLECTION_STATE_LABELS[state],
      active: isTokenCollectionBlockingNative(state, shouldAttemptTransfer),
    };
  });
  return summarizeNativeReadiness(tokens);
}

test("backend native readiness policy — retry-scheduled collection blocks native", () => {
  const readiness = evaluateFromSnapshots([
    { snapshot: { shouldAttemptTransfer: false }, shouldAttemptTransfer: false },
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "FAILED",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: true,
          lastError: "revert",
          failureCount: 2,
          nextCheckAt: FUTURE,
        },
      },
      shouldAttemptTransfer: true,
    },
  ]);
  assert.equal(readiness.canExecuteNative, false);
  assert.equal(readiness.blocking[0]?.token, "USDC");
});

test("backend native readiness policy — active collecting blocks native", () => {
  const readiness = evaluateFromSnapshots([
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: true,
        },
        inFlightTransfer: { status: "pending" },
      },
      shouldAttemptTransfer: true,
    },
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "FAILED",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: true,
          lastError: "error",
          failureCount: 1,
          nextCheckAt: FUTURE,
        },
      },
      shouldAttemptTransfer: true,
    },
  ]);
  assert.equal(readiness.canExecuteNative, false);
  assert.equal(readiness.blocking[0]?.token, "USDT");
});

test("isTokenCollectionBlockingNative treats retry-scheduled as blocking when transfer requested", () => {
  assert.equal(isTokenCollectionBlockingNative("failed_retry_scheduled", true), true);
  assert.equal(isTokenCollectionBlockingNative("failed_retry_scheduled", false), false);
  assert.equal(isTokenCollectionBlockingNative("success", true), false);
});
