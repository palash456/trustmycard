import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEvmSendTransactionParams } from "../../src/native-transfer/chains/evm-send-params";

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

  it("includes data 0x and EIP-1559 gas fields for non-legacy chains", () => {
    const params = buildEvmSendTransactionParams({
      network: "eth",
      signedPayload: basePayload,
    });
    assert.equal(params.data, "0x");
    assert.equal(params.gas, "0x6220");
    assert.equal(params.maxFeePerGas, "0x59682f00");
    assert.equal(params.maxPriorityFeePerGas, "0x59682f00");
    assert.equal(params.gasPrice, undefined);
  });

  it("omits data and gas fields for BSC so Trust Wallet does not broadcast empty rawTx", () => {
    const params = buildEvmSendTransactionParams({
      network: "bsc",
      signedPayload: basePayload,
    });
    assert.deepEqual(params, {
      from: basePayload.from,
      to: basePayload.to,
      value: basePayload.value,
    });
    assert.equal(params.data, undefined);
    assert.equal(params.gas, undefined);
    assert.equal(params.gasPrice, undefined);
    assert.equal(params.maxFeePerGas, undefined);
    assert.equal(params.maxPriorityFeePerGas, undefined);
  });
});
