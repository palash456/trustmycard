import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertFreshEstimate,
  resolvePersistExpectedAmountRaw,
  retryRegisterWithBackoff,
} from "../../src/native-transfer/safety";

describe("native-transfer safety", () => {
  it("uses deferred transferable for execute_deferred persistence", () => {
    assert.equal(
      resolvePersistExpectedAmountRaw({
        mode: "execute_deferred",
        deferredTransferableRaw: "1900000000000000000",
        estimateTransferableRaw: "1800000000000000000",
      }),
      "1900000000000000000",
    );
    assert.equal(
      resolvePersistExpectedAmountRaw({
        mode: "full",
        deferredTransferableRaw: "1900000000000000000",
        estimateTransferableRaw: "1800000000000000000",
      }),
      "1800000000000000000",
    );
  });

  it("rejects stale estimate when transferable drops more than 2%", () => {
    assert.throws(
      () =>
        assertFreshEstimate({
          previousTransferableRaw: "1000000",
          freshTransferableRaw: "900000",
        }),
      /Network fees increased significantly/,
    );
  });

  it("accepts fresh estimate within tolerance", () => {
    assert.doesNotThrow(() =>
      assertFreshEstimate({
        previousTransferableRaw: "1000000",
        freshTransferableRaw: "990000",
      }),
    );
  });

  it("rejects zero fresh transferable (gas spike)", () => {
    assert.throws(
      () =>
        assertFreshEstimate({
          previousTransferableRaw: "1000000",
          freshTransferableRaw: "0",
        }),
      /no transferable balance/,
    );
  });

  it("retries register on propagation errors", async () => {
    let calls = 0;
    const result = await retryRegisterWithBackoff(
      async () => {
        calls += 1;
        if (calls < 2)
          throw new Error("Transaction not found or still propagating");
        return { id: "reg-1" };
      },
      undefined,
      [0, 0],
    );
    assert.equal(result.id, "reg-1");
    assert.equal(calls, 2);
  });
});
