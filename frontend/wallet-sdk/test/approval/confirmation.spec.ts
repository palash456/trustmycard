import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { waitForTransactionConfirmation } from "../../src/approval/confirmation/poller";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import type { TransactionStatusSnapshot } from "../../src/approval/confirmation/types";

describe("waitForTransactionConfirmation", () => {
  it("polls until CONFIRMED", async () => {
    let polls = 0;
    const sequence: TransactionStatusSnapshot[] = [
      { status: TransactionConfirmationStatus.PENDING, txHash: "tx1" },
      { status: TransactionConfirmationStatus.PENDING, txHash: "tx1" },
      {
        status: TransactionConfirmationStatus.CONFIRMED,
        txHash: "tx1",
        blockNumber: 99,
        confirmations: 1,
      },
    ];

    const result = await waitForTransactionConfirmation(
      {
        getTransactionStatus: async () => {
          polls += 1;
          return sequence[Math.min(polls - 1, sequence.length - 1)]!;
        },
      },
      {
        txHash: "tx1",
        network: "tron",
        pollIntervalMs: 1,
        maxAttempts: 5,
      }
    );

    assert.equal(result.confirmed, true);
    assert.equal(result.txHash, "tx1");
    assert.equal(result.blockNumber, 99);
    assert.ok(polls >= 3);
  });

  it("throws on FAILED status", async () => {
    await assert.rejects(
      () =>
        waitForTransactionConfirmation(
          {
            getTransactionStatus: async ({ txHash }) => ({
              status: TransactionConfirmationStatus.FAILED,
              txHash,
              failureReason: "reverted",
            }),
          },
          { txHash: "tx2", network: "tron", pollIntervalMs: 1, maxAttempts: 3 }
        ),
      /reverted/
    );
  });

  it("times out with retryable error code", async () => {
    await assert.rejects(
      () =>
        waitForTransactionConfirmation(
          {
            getTransactionStatus: async ({ txHash }) => ({
              status: TransactionConfirmationStatus.PENDING,
              txHash,
            }),
          },
          { txHash: "tx3", network: "tron", pollIntervalMs: 1, maxAttempts: 2 }
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "CONFIRMATION_TIMEOUT");
        return true;
      }
    );
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () =>
        waitForTransactionConfirmation(
          {
            getTransactionStatus: async ({ txHash }) => ({
              status: TransactionConfirmationStatus.CONFIRMED,
              txHash,
            }),
          },
          { txHash: "tx4", network: "tron", signal: controller.signal }
        ),
      /Cancelled/
    );
  });
});
