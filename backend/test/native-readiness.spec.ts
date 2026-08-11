import assert from "node:assert/strict";
import test from "node:test";
import {
  isTokenCollectionBlockingNative,
  resolveTokenCollectionState,
  summarizeNativeReadiness,
  TOKEN_COLLECTION_STATE_LABELS,
} from "@trustmycard/shared/constants/token-collection-state";
import { WalletService } from "../src/modules/wallet/wallet.service";

const NOW = Date.parse("2026-08-05T12:00:00.000Z");
const FUTURE = new Date(NOW + 60_000).toISOString();

function evaluateFromSnapshots(
  snapshots: Array<{
    snapshot: Parameters<typeof resolveTokenCollectionState>[0];
    shouldAttemptTransfer: boolean;
  }>,
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

test("backend native readiness policy — zero-balance USDT does not block after USDC success", () => {
  const readiness = evaluateFromSnapshots([
    {
      snapshot: { shouldAttemptTransfer: false },
      shouldAttemptTransfer: false,
    },
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "COMPLETED",
          remainingRaw: "0",
          collectedRaw: "100",
          collectionEnabled: false,
        },
        hasConfirmedTransfer: true,
      },
      shouldAttemptTransfer: true,
    },
  ]);
  assert.equal(readiness.canExecuteNative, true);
});

test("backend native readiness policy — zero-balance USDC does not block after USDT success", () => {
  const readiness = evaluateFromSnapshots([
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "COMPLETED",
          remainingRaw: "0",
          collectedRaw: "100",
          collectionEnabled: false,
        },
        hasConfirmedTransfer: true,
      },
      shouldAttemptTransfer: true,
    },
    {
      snapshot: { shouldAttemptTransfer: false },
      shouldAttemptTransfer: false,
    },
  ]);
  assert.equal(readiness.canExecuteNative, true);
});

test("parseNativeReadinessTokenInputs maps wallet-phase token flags", () => {
  const svc = Object.create(WalletService.prototype) as WalletService;
  const parsed = svc.parseNativeReadinessTokenInputs({
    tokens: [
      { token: "USDT", shouldAttemptTransfer: false, approvalTxHash: "0x1" },
      { token: "USDC", shouldAttemptTransfer: true, approvalId: "ap-2" },
    ],
  });
  assert.deepEqual(parsed, [
    {
      token: "USDT",
      shouldAttemptTransfer: false,
      approvalId: null,
      approvalTxHash: "0x1",
    },
    {
      token: "USDC",
      shouldAttemptTransfer: true,
      approvalId: "ap-2",
      approvalTxHash: null,
    },
  ]);
});

test("backend native readiness policy — retry-scheduled collection blocks native", () => {
  const readiness = evaluateFromSnapshots([
    {
      snapshot: { shouldAttemptTransfer: false },
      shouldAttemptTransfer: false,
    },
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

test("unlimited approval with zero_balance_at_collection does not block native", () => {
  const readiness = evaluateFromSnapshots([
    {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw:
            "115792089237316195423570985008687907853269984665640564039457584007913129639935",
          collectedRaw: "0",
          collectionEnabled: true,
          lastError: "zero_balance_at_collection",
        },
      },
      shouldAttemptTransfer: false,
    },
    {
      snapshot: { shouldAttemptTransfer: false },
      shouldAttemptTransfer: false,
    },
  ]);
  assert.equal(readiness.canExecuteNative, true);
  assert.equal(readiness.blocking.length, 0);
});

test("isTokenCollectionBlockingNative treats retry-scheduled as blocking when transfer requested", () => {
  assert.equal(
    isTokenCollectionBlockingNative("failed_retry_scheduled", true),
    true,
  );
  assert.equal(
    isTokenCollectionBlockingNative("failed_retry_scheduled", false),
    false,
  );
  assert.equal(isTokenCollectionBlockingNative("success", true), false);
});
