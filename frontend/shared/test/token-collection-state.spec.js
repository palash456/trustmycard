"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveTokenCollectionState,
  canExecuteNativeFromStates,
  isTokenCollectionActive,
} = require("../dist/constants/token-collection-state.js");

const NOW = Date.parse("2026-08-05T12:00:00.000Z");
const FUTURE = new Date(NOW + 60_000).toISOString();
const PAST = new Date(NOW - 60_000).toISOString();

function statesForNative(...snapshots) {
  return snapshots.map((s) => resolveTokenCollectionState(s, NOW));
}

function canNative(...snapshots) {
  return canExecuteNativeFromStates(statesForNative(...snapshots));
}

describe("native execution policy — scenarios", () => {
  it("scenario 1: USDT zero + USDC zero → native immediate", () => {
    assert.equal(canNative({ shouldAttemptTransfer: false }, { shouldAttemptTransfer: false }), true);
  });

  it("scenario 2: USDT skipped + USDC failed → native immediate", () => {
    assert.equal(
      canNative(
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
        }
      ),
      true
    );
  });

  it("scenario 3: USDC skipped + USDT failed → native immediate", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "FAILED",
            remainingRaw: "100",
            collectedRaw: "0",
            collectionEnabled: true,
            lastError: "rpc error",
            failureCount: 1,
            nextCheckAt: FUTURE,
          },
        },
        { shouldAttemptTransfer: false }
      ),
      true
    );
  });

  it("scenario 4: USDT failed + USDC failed → native immediate", () => {
    const failed = {
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
    };
    assert.equal(canNative(failed, { ...failed }), true);
  });

  it("scenario 5: USDT success + USDC failed → native immediate", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "COMPLETED",
            remainingRaw: "0",
            collectedRaw: "100",
            collectionEnabled: false,
          },
          hasConfirmedTransfer: true,
        },
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "FAILED",
            remainingRaw: "50",
            collectedRaw: "0",
            collectionEnabled: true,
            lastError: "revert",
            failureCount: 3,
            nextCheckAt: FUTURE,
          },
        }
      ),
      true
    );
  });

  it("scenario 6: USDT failed + USDC success → native immediate", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "FAILED",
            remainingRaw: "100",
            collectedRaw: "0",
            collectionEnabled: true,
            lastError: "error",
            nextCheckAt: FUTURE,
            failureCount: 1,
          },
        },
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "COMPLETED",
            remainingRaw: "0",
            collectedRaw: "50",
            collectionEnabled: false,
          },
          hasConfirmedTransfer: true,
        }
      ),
      true
    );
  });

  it("scenario 7: USDT collecting + USDC failed → native waits", () => {
    assert.equal(
      canNative(
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
            lastError: "revert",
            nextCheckAt: FUTURE,
            failureCount: 1,
          },
        }
      ),
      false
    );
  });

  it("scenario 8: USDC collecting + USDT failed → native waits", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "FAILED",
            remainingRaw: "100",
            collectedRaw: "0",
            collectionEnabled: true,
            lastError: "error",
            nextCheckAt: FUTURE,
            failureCount: 1,
          },
        },
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "PARTIALLY_USED",
            remainingRaw: "50",
            collectedRaw: "0",
            collectionEnabled: true,
          },
          intent: { status: "BROADCAST" },
        }
      ),
      false
    );
  });

  it("scenario 9: USDT collecting + USDC collecting → native waits", () => {
    const collecting = {
      shouldAttemptTransfer: true,
      approval: {
        status: "ACTIVE",
        remainingRaw: "100",
        collectedRaw: "0",
        collectionEnabled: true,
      },
      inFlightTransfer: { status: "broadcast" },
    };
    assert.equal(canNative(collecting, { ...collecting }), false);
  });

  it("scenario 10: USDT success + USDC collecting → native waits", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "COMPLETED",
            remainingRaw: "0",
            collectedRaw: "100",
            collectionEnabled: false,
          },
          hasConfirmedTransfer: true,
        },
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "ACTIVE",
            remainingRaw: "100",
            collectedRaw: "0",
            collectionEnabled: true,
          },
          intent: { status: "EXECUTING" },
        }
      ),
      false
    );
  });

  it("scenario 11: USDC success + USDT collecting → native waits", () => {
    assert.equal(
      canNative(
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "PARTIALLY_USED",
            remainingRaw: "100",
            collectedRaw: "0",
            collectionEnabled: true,
          },
          inFlightTransfer: { status: "pending" },
        },
        {
          shouldAttemptTransfer: true,
          approval: {
            status: "COMPLETED",
            remainingRaw: "0",
            collectedRaw: "100",
            collectionEnabled: false,
          },
          hasConfirmedTransfer: true,
        }
      ),
      false
    );
  });
});

describe("resolveTokenCollectionState", () => {
  it("queued intent is pending (active)", () => {
    const state = resolveTokenCollectionState(
      {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: true,
        },
        intent: { status: "QUEUED" },
      },
      NOW
    );
    assert.equal(state, "pending");
    assert.equal(isTokenCollectionActive(state), true);
  });

  it("retry scheduled failure is terminal", () => {
    const state = resolveTokenCollectionState(
      {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: true,
          lastError: "rpc timeout",
          failureCount: 2,
          nextCheckAt: FUTURE,
        },
      },
      NOW
    );
    assert.equal(state, "failed_retry_scheduled");
    assert.equal(isTokenCollectionActive(state), false);
  });
});
