import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatInsufficientNativeFeeMessage,
  isNativeTransferEstimateSufficient,
  preflightNativeTransferEstimate,
} from "../../src/authorization/native-preflight";
import type { NativeTransferEstimate } from "../../src/native-transfer/types";

const baseEstimate: NativeTransferEstimate = {
  network: "avax",
  owner: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  assetSymbol: "AVAX",
  balanceRaw: "1000000000000000000",
  balanceHuman: "1",
  feeRaw: "100000000000000000",
  feeHuman: "0.1",
  transferableRaw: "900000000000000000",
  transferableHuman: "0.9",
  canTransfer: true,
};

describe("native preflight helpers", () => {
  it("isNativeTransferEstimateSufficient requires positive transferableRaw", () => {
    assert.equal(isNativeTransferEstimateSufficient(baseEstimate), true);
    assert.equal(
      isNativeTransferEstimateSufficient({
        ...baseEstimate,
        canTransfer: false,
        transferableRaw: "0",
      }),
      false,
    );
    assert.equal(
      isNativeTransferEstimateSufficient({
        ...baseEstimate,
        transferableRaw: "0",
      }),
      false,
    );
  });

  it("formatInsufficientNativeFeeMessage uses chain native symbol", () => {
    assert.equal(
      formatInsufficientNativeFeeMessage("avax"),
      "Add more AVAX for network fees",
    );
    assert.equal(
      formatInsufficientNativeFeeMessage("bsc"),
      "Add more BNB for network fees",
    );
    assert.equal(
      formatInsufficientNativeFeeMessage("tron"),
      "Add more TRX for network fees",
    );
  });

  it("preflightNativeTransferEstimate returns friendly message when estimate is dust", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ...baseEstimate,
          canTransfer: false,
          transferableRaw: "0",
          transferableHuman: "0",
          message: "Insufficient balance after estimated network fees",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    try {
      const result = await preflightNativeTransferEstimate({
        apiBaseUrl: "http://localhost:3000",
        network: "avax",
        owner: baseEstimate.owner,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.message, "Add more AVAX for network fees");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
