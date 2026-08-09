import assert from "node:assert/strict";
import test from "node:test";
import { getEvmTransactionStatus } from "../../src/approval/confirmation/rpc-status";

const originalFetch = globalThis.fetch;

test("getEvmTransactionStatus tries next RPC when first returns null receipt", async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    const hasReceipt = callCount >= 2;
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: hasReceipt
          ? {
              status: "0x1",
              blockNumber: "0x10",
            }
          : null,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const status = await getEvmTransactionStatus({
      txHash: "0xdead",
      network: "eth",
    });
    assert.ok(callCount >= 2);
    assert.equal(status.status, "CONFIRMED");
    assert.equal(status.blockNumber, 16);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getEvmTransactionStatus returns PENDING when all RPCs return null", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const status = await getEvmTransactionStatus({
      txHash: "0xdead",
      network: "bsc",
    });
    assert.equal(status.status, "PENDING");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
