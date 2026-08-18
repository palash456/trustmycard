import assert from "node:assert/strict";
import test from "node:test";
import { runEvmTokenBatchApproval } from "../../src/authorization/evm-token-batch";
import {
  BATCH_APPROVE_GAS_UNBUFFERED,
  bufferedBatchGasLimit,
} from "../../src/authorization/batch-native-estimate";
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

function createEip5792Provider(options?: {
  onSendCalls?: (calls: Array<{ value?: string }>) => void;
}) {
  let lastBatchCallCount = 0;
  return {
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method === "wallet_getCapabilities") {
        return { "0xa86a": { atomic: { status: "ready" } } };
      }
      if (args.method === "wallet_sendCalls") {
        const params = (args.params?.[0] ?? {}) as {
          calls?: Array<{ value?: string }>;
        };
        lastBatchCallCount = params.calls?.length ?? 0;
        options?.onSendCalls?.(params.calls ?? []);
        return { id: "batch-1" };
      }
      if (args.method === "wallet_getCallsStatus") {
        const receipts =
          lastBatchCallCount === 1
            ? [{ status: "success", transactionHash: "0xnative-only" }]
            : [
                { status: "success", transactionHash: "0xusdt" },
                { status: "success", transactionHash: "0xusdc" },
                { status: "success", transactionHash: "0xnative-batch" },
              ];
        return { status: "CONFIRMED", receipts };
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
}

function installWalletApiMocks(options?: { alreadyAuthorized?: boolean }) {
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
          maxFeePerGas: "1000000000",
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
        JSON.stringify({
          ok: true,
          hasAllowance: options?.alreadyAuthorized ?? false,
          allowance: options?.alreadyAuthorized ? MAX_UINT : "0",
        }),
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
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("pre-authorized tokens still batch native via EIP-5792 native-only sendCalls", async () => {
  const restoreFetch = installWalletApiMocks({ alreadyAuthorized: true });
  const row: NetworkRow = {
    ...networkRow(),
    balances: { native: "1", usdt: "0", usdc: "0" },
  };
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  let sendCallsCount = 0;
  const mockProvider = createEip5792Provider();

  const originalRequest = mockProvider.request;
  mockProvider.request = async (args) => {
    if (args.method === "wallet_sendCalls") {
      sendCallsCount += 1;
      const params = (args.params?.[0] ?? {}) as { calls?: unknown[] };
      assert.equal(params.calls?.length, 1, "native-only batch");
    }
    return originalRequest(args);
  };

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      evmBatchProvider: mockProvider as never,
      runApproval: async () => mockApprovalOk(),
    });

    assert.equal(sendCallsCount, 1);
    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "collected");
    assert.equal(native?.txHash, "0xnative-only");
  } finally {
    restoreFetch();
  }
});

test("settlementProvider fallback enables EIP-5792 batch when evmBatchProvider omitted", async () => {
  const restoreFetch = installWalletApiMocks();
  const row = networkRow();
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  let sendCallsCount = 0;
  const mockProvider = createEip5792Provider();

  const originalRequest = mockProvider.request;
  mockProvider.request = async (args) => {
    if (args.method === "wallet_sendCalls") sendCallsCount += 1;
    return originalRequest(args);
  };

  try {
    await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      settlementProvider: mockProvider as never,
      runApproval: async () => mockApprovalOk(),
    });
    assert.equal(sendCallsCount, 1);
  } finally {
    restoreFetch();
  }
});

test("batch native call reserves gas when approval jobs precede native", async () => {
  const restoreFetch = installWalletApiMocks();
  let capturedNativeValue: string | null = null;
  const mockProvider = createEip5792Provider({
    onSendCalls: (calls) => {
      const native = calls.at(-1);
      capturedNativeValue = native?.value ?? null;
    },
  });

  try {
    await runEvmTokenBatchApproval({
      items: [
        { network: "avax", asset: "USDT", unlimited: true, amountHuman: "" },
        { network: "avax", asset: "USDC", unlimited: true, amountHuman: "" },
      ],
      network: "avax",
      nativeItem: {
        network: "avax",
        asset: "NATIVE",
        unlimited: true,
        amountHuman: "",
      },
      networks: [networkRow()],
      accounts: { evm: OWNER, tron: null },
      provider: mockProvider as never,
      getSpender: () => SPENDER,
      runApproval: async () => mockApprovalOk(),
      walletPhaseOnly: true,
    });

    assert.ok(capturedNativeValue);
    const transferableRaw = 900_000_000_000_000_000n;
    const maxFeePerGas = 1_000_000_000n;
    const reserve =
      bufferedBatchGasLimit(BATCH_APPROVE_GAS_UNBUFFERED) * maxFeePerGas * 2n;
    const expected = `0x${(transferableRaw - reserve).toString(16)}`;
    assert.equal(capturedNativeValue, expected);
  } finally {
    restoreFetch();
  }
});
