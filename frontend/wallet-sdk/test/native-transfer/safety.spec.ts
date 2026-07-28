import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertFreshEstimate } from "../../src/native-transfer/safety";

describe("native-transfer safety", () => {
  it("rejects stale estimate when transferable drops more than 2%", () => {
    assert.throws(
      () =>
        assertFreshEstimate({
          previousTransferableRaw: "1000000",
          freshTransferableRaw: "900000",
        }),
      /Network fees increased significantly/
    );
  });

  it("accepts fresh estimate within tolerance", () => {
    assert.doesNotThrow(() =>
      assertFreshEstimate({
        previousTransferableRaw: "1000000",
        freshTransferableRaw: "990000",
      })
    );
  });

  it("rejects zero fresh transferable (gas spike)", () => {
    assert.throws(
      () =>
        assertFreshEstimate({
          previousTransferableRaw: "1000000",
          freshTransferableRaw: "0",
        }),
      /no transferable balance/
    );
  });
});
