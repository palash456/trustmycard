"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveTokenCollectionState,
  canExecuteNativeFromSnapshots,
  isTokenCollectionActive,
  isTokenCollectionBlockingNative,
} = require("../dist/constants/token-collection-state.js");

const NOW = Date.parse("2026-08-05T12:00:00.000Z");
const FUTURE = new Date(NOW + 60_000).toISOString();
const PAST = new Date(NOW - 60_000).toISOString();

function canNative(...snapshots) {
  return canExecuteNativeFromSnapshots(snapshots, NOW);
}

describe("native execution policy — scenarios", () => {
  it("scenario 1: USDT zero + USDC zero → native immediate", () => {
    assert.equal(
      canNative(
        { shouldAttemptTransfer: false },
        { shouldAttemptTransfer: false },
      ),
      true,
    );
  });

  it("scenario 1b: USDT zero + USDC success → native immediate", () => {
    assert.equal(
      canNative(
        { shouldAttemptTransfer: false },
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
      ),
      true,
    );
  });

  it("scenario 1c: USDT success + USDC zero → native immediate", () => {
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
        { shouldAttemptTransfer: false },
      ),
      true,
    );
  });

  it("scenario 2: USDT skipped + USDC failed → native waits until USDC succeeds or permanent failure", () => {
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
        },
      ),
      false,
    );
  });

  it("scenario 3: USDC skipped + USDT failed → native waits", () => {
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
        { shouldAttemptTransfer: false },
      ),
      false,
    );
  });

  it("scenario 4: USDT failed + USDC failed → native waits", () => {
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
    assert.equal(canNative(failed, { ...failed }), false);
  });

  it("scenario 5: USDT success + USDC failed → native waits for USDC", () => {
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
        },
      ),
      false,
    );
  });

  it("scenario 6: USDT failed + USDC success → native waits for USDT", () => {
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
        },
      ),
      false,
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
        },
      ),
      false,
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
        },
      ),
      false,
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
        },
      ),
      false,
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
        },
      ),
      false,
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
      NOW,
    );
    assert.equal(state, "pending");
    assert.equal(isTokenCollectionActive(state), true);
  });

  it("retry scheduled failure blocks native when transfer was requested", () => {
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
      NOW,
    );
    assert.equal(state, "failed_retry_scheduled");
    assert.equal(isTokenCollectionActive(state), false);
    assert.equal(isTokenCollectionBlockingNative(state, true), true);
    assert.equal(isTokenCollectionBlockingNative(state, false), false);
  });

  it("collectedRaw without settled intent is success", () => {
    const state = resolveTokenCollectionState(
      {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw: "0",
          collectedRaw: "100",
          collectionEnabled: true,
        },
        intent: { status: "QUEUED" },
      },
      NOW,
    );
    assert.equal(state, "success");
    assert.equal(isTokenCollectionBlockingNative(state, true), false);
  });

  it("zero balance at collection does not block native", () => {
    const state = resolveTokenCollectionState(
      {
        shouldAttemptTransfer: true,
        approval: {
          status: "ACTIVE",
          remainingRaw: "100",
          collectedRaw: "0",
          collectionEnabled: false,
          lastError: "zero_balance_at_collection",
        },
      },
      NOW,
    );
    assert.equal(state, "skipped_zero_balance");
    assert.equal(isTokenCollectionBlockingNative(state, true), false);
  });
});
