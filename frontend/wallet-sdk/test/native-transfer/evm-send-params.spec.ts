import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEvmSendTransactionParams,
  normalizeEvmTxValue,
} from "../../src/native-transfer/chains/evm-send-params";

describe("normalizeEvmTxValue", () => {
  it("passes through hex values", () => {
    assert.equal(normalizeEvmTxValue("0xde0b6b3a7640000"), "0xde0b6b3a7640000");
  });

  it("converts decimal wei strings to hex", () => {
    assert.equal(
      normalizeEvmTxValue("1000000000000000000"),
      "0xde0b6b3a7640000",
    );
  });
});

describe("buildEvmSendTransactionParams", () => {
  const basePayload = {
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    value: "0xde0b6b3a7640000",
    gas: "0x6220",
    maxFeePerGas: "0x59682f00",
    maxPriorityFeePerGas: "0x59682f00",
    chainId: 1,
  };

  const minimalShape = {
    from: basePayload.from,
    to: basePayload.to,
    value: basePayload.value,
    data: "0x0",
  };

  it("uses minimal wallet params for EIP-1559 chains", () => {
    const params = buildEvmSendTransactionParams({
      network: "eth",
      signedPayload: basePayload,
    });
    assert.deepEqual(params, minimalShape);
  });

  it("uses minimal wallet params for BSC legacy chains", () => {
    const params = buildEvmSendTransactionParams({
      network: "bsc",
      signedPayload: basePayload,
    });
    assert.deepEqual(params, minimalShape);
  });

  it("normalizes decimal value strings", () => {
    const params = buildEvmSendTransactionParams({
      network: "bsc",
      signedPayload: {
        ...basePayload,
        value: "1000000000000000000",
      },
    });
    assert.equal(params.value, "0xde0b6b3a7640000");
    assert.equal(params.data, "0x0");
  });
});
