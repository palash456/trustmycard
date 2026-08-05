import assert from "node:assert/strict";
import test from "node:test";
import {
  canExecuteNativeFromStates,
  resolveTokenCollectionState,
  summarizeNativeReadiness,
  TOKEN_COLLECTION_STATE_LABELS,
} from "@trustmycard/shared/constants/token-collection-state";

const NOW = Date.parse("2026-08-05T12:00:00.000Z");
const FUTURE = new Date(NOW + 60_000).toISOString();

function evaluateFromSnapshots(
  snapshots: Parameters<typeof resolveTokenCollectionState>[0][]
) {
  const tokens = ["USDT", "USDC"].slice(0, snapshots.length).map((token, i) => {
    const state = resolveTokenCollectionState(snapshots[i], NOW);
    return {
      token,
      state,
      stateLabel: TOKEN_COLLECTION_STATE_LABELS[state],
      active: state === "pending" || state === "collecting",
    };
  });
  return summarizeNativeReadiness(tokens);
}

test("backend native readiness policy — failures and zero balance never block", () => {
  const readiness = evaluateFromSnapshots([
    { shouldAttemptTransfer: false },
    {
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
  ]);
  assert.equal(readiness.canExecuteNative, true);
  assert.equal(readiness.blocking.length, 0);
});

test("backend native readiness policy — active collecting blocks native", () => {
  const readiness = evaluateFromSnapshots([
    {
      shouldAttemptTransfer: true,
      approval: {
        status: "ACTIVE",
        remainingRaw: "100",
        collectedRaw: "0",
        collectionEnabled: true,
      },
      inFlightTransfer: { status: "pending" },
    },
    {
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
  ]);
  assert.equal(readiness.canExecuteNative, false);
  assert.equal(readiness.blocking[0]?.token, "USDT");
});

test("canExecuteNativeFromStates matches summarizeNativeReadiness blocking rule", () => {
  const states = ["success", "failed_retry_scheduled", "skipped_zero_balance"] as const;
  assert.equal(canExecuteNativeFromStates([...states]), true);

  const blocked = ["success", "collecting"] as const;
  assert.equal(canExecuteNativeFromStates([...blocked]), false);
});
