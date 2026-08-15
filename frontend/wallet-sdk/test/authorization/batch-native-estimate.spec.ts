import assert from "node:assert/strict";
import test from "node:test";
import {
  BATCH_APPROVE_GAS_UNBUFFERED,
  buildNativeWalletCall,
  buildNativeWalletCallForBatch,
  bufferedBatchGasLimit,
  fetchNativeTransferEstimate,
  reserveBatchApprovalGas,
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

test("reserveBatchApprovalGas subtracts buffered approve gas per batch job", () => {
  const estimate = {
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
  };

  const perApprove = bufferedBatchGasLimit(BATCH_APPROVE_GAS_UNBUFFERED);
  const reserve = perApprove * BigInt(estimate.maxFeePerGas!) * 2n;
  const adjusted = reserveBatchApprovalGas({ estimate, approvalJobCount: 2 });
  assert.ok(adjusted);
  assert.equal(
    adjusted!.transferableRaw,
    (BigInt(estimate.transferableRaw) - reserve).toString(),
  );
});

test("reserveBatchApprovalGas returns null when reserve exceeds transferable", () => {
  const estimate = {
    network: "avax",
    owner: "0x1111111111111111111111111111111111111111",
    recipient: "0x2222222222222222222222222222222222222222",
    transferableRaw: "1000",
    canTransfer: true,
    assetSymbol: "AVAX",
    balanceRaw: "2000",
    balanceHuman: "0",
    feeRaw: "1000",
    feeHuman: "0",
    transferableHuman: "0",
    gasLimit: "21000",
    maxFeePerGas: "1000000000",
    chainId: 43114,
  };
  assert.equal(
    reserveBatchApprovalGas({ estimate, approvalJobCount: 2 }),
    null,
  );
});

test("buildNativeWalletCallForBatch uses reserved transferable for approval jobs", () => {
  const estimate = {
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
    chainId: 43114,
  };
  const plain = buildNativeWalletCall(estimate);
  const batched = buildNativeWalletCallForBatch(estimate, 2);
  assert.ok(plain);
  assert.ok(batched);
  assert.notEqual(plain!.value, batched!.value);
  assert.ok(BigInt(batched!.value) < BigInt(plain!.value));
});
