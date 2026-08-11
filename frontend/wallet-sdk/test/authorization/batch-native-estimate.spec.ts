import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNativeWalletCall,
  fetchNativeTransferEstimate,
} from "../../src/authorization/batch-native-estimate";

test("fetchNativeTransferEstimate does not send wallet session Authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders: HeadersInit | undefined;

  globalThis.fetch = (async (_input, init) => {
    capturedHeaders = init?.headers;
    return new Response(
      JSON.stringify({
        network: "avax",
        owner: "0x1111111111111111111111111111111111111111",
        recipient: "0x2222222222222222222222222222222222222222",
        transferableRaw: "1000000000000000000",
        canTransfer: true,
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const estimate = await fetchNativeTransferEstimate({
      apiBaseUrl: "",
      network: "avax",
      owner: "0x1111111111111111111111111111111111111111",
    });
    assert.ok(estimate);
    const headers = capturedHeaders as Record<string, string> | undefined;
    assert.equal(headers?.authorization, undefined);
    assert.equal(headers?.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchNativeTransferEstimate returns null when estimate is not transferable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        network: "avax",
        owner: "0x1111111111111111111111111111111111111111",
        recipient: "0x2222222222222222222222222222222222222222",
        transferableRaw: "0",
        canTransfer: false,
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  try {
    const estimate = await fetchNativeTransferEstimate({
      network: "avax",
      owner: "0x1111111111111111111111111111111111111111",
    });
    assert.equal(estimate, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildNativeWalletCall encodes full transferable value for EIP-5792 native batch", () => {
  const call = buildNativeWalletCall({
    network: "avax",
    owner: "0x1111111111111111111111111111111111111111",
    recipient: "0x2222222222222222222222222222222222222222",
    transferableRaw: "1000000000000000000",
    canTransfer: true,
    assetSymbol: "AVAX",
    balanceRaw: "2000000000000000000",
    balanceHuman: "2",
    feeRaw: "1000000000000000000",
    feeHuman: "1",
    transferableHuman: "1",
    gasLimit: "21000",
    maxFeePerGas: "1000000000",
    maxPriorityFeePerGas: "0",
    chainId: 43114,
  });

  assert.ok(call);
  assert.equal(call?.to, "0x2222222222222222222222222222222222222222");
  assert.equal(call?.data, "0x");
  assert.equal(call?.value, "0xde0b6b3a7640000");
});
