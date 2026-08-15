import assert from "node:assert/strict";
import test from "node:test";
import { runEvmTokenBatchApproval } from "../../src/authorization/evm-token-batch";
import { runAuthorizationSettlement } from "../../src/authorization/phases/settlement-coordinator";
import { runAuthorizationSession } from "../../src/authorization/session";
import {
  clearCachedWalletSessionToken,
  setCachedWalletSessionToken,
} from "../../src/authorization/wallet-session-cache";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";
const AVAX_USDT = "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";
const AVAX_USDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const MAX_UINT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const networks: NetworkRow[] = [
  {
    key: "avax",
    name: "Avalanche",
    standard: "ERC-20",
    color: "#E84142",
    letter: "A",
    balances: { native: "1", usdt: "10", usdc: "5" },
  },
];

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

function installWalletApiMocks() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

    if (url.includes("/api/auth/wallet/challenge")) {
      return new Response(
        JSON.stringify({
          sessionId: "sess-1",
          challenge: "Sign in to Trust My Card",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/auth/wallet/verify")) {
      return new Response(
        JSON.stringify({
          token: "wallet-token-abc",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
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
      return new Response(
        JSON.stringify({ ok: true, ready: true }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createEip5792Provider(options: {
  onRequest?: (method: string) => void;
  callsStatusError?: Error;
}) {
  const calls: string[] = [];
  return {
    provider: {
      request: async (args: { method: string; params?: unknown[] }) => {
        options.onRequest?.(args.method);
        calls.push(args.method);
        if (args.method === "wallet_getCapabilities") {
          return { "0xa86a": { atomic: { status: "ready" } } };
        }
        if (args.method === "eth_chainId") {
          return "0xa86a";
        }
        if (args.method === "wallet_sendCalls") {
          return { id: "batch-submitted-1" };
        }
        if (args.method === "wallet_getCallsStatus") {
          if (options.callsStatusError) {
            throw options.callsStatusError;
          }
          return {
            status: "CONFIRMED",
            receipts: [
              { status: "success", transactionHash: "0xusdt" },
              { status: "success", transactionHash: "0xusdc" },
            ],
          };
        }
        throw new Error(`unexpected method ${args.method}`);
      },
      session: {
        topic: "mock",
        namespaces: { eip155: { accounts: [`eip155:43114:${OWNER}`] } },
      },
    },
    calls,
  };
}

test("EVM wallet phase does NOT call eth_signTransaction or authorize_only native", async () => {
  const restoreFetch = installWalletApiMocks();
  const nativeModes: string[] = [];
  const providerMethods: string[] = [];

  const provider = {
    request: async (args: { method: string }) => {
      providerMethods.push(args.method);
      if (args.method === "personal_sign") {
        return "0xsig";
      }
      if (args.method === "eth_sendTransaction") {
        return "0xapprove";
      }
      throw new Error(`unexpected ${args.method}`);
    },
  };

  try {
    const summary = await runAuthorizationSession({
      items: [
        { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
        { network: "pol", asset: "NATIVE", unlimited: true, amountHuman: "" },
      ],
      networks: [
        {
          key: "pol",
          name: "Polygon",
          standard: "ERC-20",
          color: "#8247E5",
          letter: "P",
          balances: { native: "1", usdt: "10", usdc: "0" },
        },
      ],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: provider as never,
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async () => mockApprovalOk(),
      runNativeTransfer: async (args) => {
        nativeModes.push(args.mode ?? "full");
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
        };
      },
    });

    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "authorized");
    assert.match(String(native?.message), /deferred/i);
    assert.equal(nativeModes.length, 0);
    assert.equal(
      providerMethods.includes("eth_signTransaction"),
      false,
      "wallet phase must not call eth_signTransaction",
    );
  } finally {
    restoreFetch();
  }
});

function installSettlementFetchMock() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/network-settlement/register")) {
      return new Response(
        JSON.stringify({ ok: true, settlementSessionId: "settle-1" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/token-collection/nudge")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/token-collection/native-readiness")) {
      return new Response(
        JSON.stringify({
          canExecuteNative: true,
          tokens: [
            {
              token: "USDT",
              state: "success",
              stateLabel: "Success",
              active: false,
            },
          ],
          blocking: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/native-complete")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("EVM native execution is deferred to settlement via eth_sendTransaction", async () => {
  const restoreFetch = installSettlementFetchMock();
  const nativeModes: string[] = [];

  const settlementCapture = {
    sessionId: "flow-test",
    network: "avax",
    owner: OWNER,
    tokens: [
      {
        item: {
          network: "avax",
          asset: "USDT" as const,
          unlimited: true,
          amountHuman: "",
        },
        orchestration: mockApprovalOk(),
        shouldAttemptTransfer: true,
      },
    ],
    native: {
      network: "avax",
      owner: OWNER,
      authorizationKind: "evm_deferred" as const,
      authorizationPayload: { evmDeferred: true },
    },
    batchId: null,
  };

  try {
    const result = await runAuthorizationSettlement({
      capture: settlementCapture,
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      walletSessionToken: "cached-token",
      getSpender: () => SPENDER,
      runApprovalSettlement: async () => mockApprovalOk(),
      runNativeTransfer: async (args) => {
        nativeModes.push(args.mode ?? "full");
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          txHash: "0xnative-settlement",
        };
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(nativeModes, ["full"]);
    const nativeItem = result.sessionResult.items.find(
      (i) => i.token === "NATIVE",
    );
    assert.equal(nativeItem?.txHash, "0xnative-settlement");
  } finally {
    restoreFetch();
  }
});

test("unsupported EIP-5792 wallets use sequential token approvals", async () => {
  const restoreFetch = installWalletApiMocks();
  let sequentialApprovals = 0;
  const providerMethods: string[] = [];

  const provider = {
    request: async (args: { method: string }) => {
      providerMethods.push(args.method);
      if (args.method === "wallet_getCapabilities") {
        throw new Error("method not found");
      }
      if (args.method === "eth_chainId") {
        return "0xa86a";
      }
      throw new Error(`unexpected ${args.method}`);
    },
  };

  try {
    const batchResults = await runEvmTokenBatchApproval({
      items: [
        { network: "avax", asset: "USDT", unlimited: true, amountHuman: "" },
        { network: "avax", asset: "USDC", unlimited: true, amountHuman: "" },
      ],
      network: "avax",
      networks,
      accounts: { evm: OWNER, tron: null },
      provider: provider as never,
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      walletPhaseOnly: true,
      runApproval: async () => {
        sequentialApprovals += 1;
        return mockApprovalOk();
      },
    });

    assert.equal(sequentialApprovals, 2);
    assert.equal(batchResults.batchMode, "sequential");
    assert.equal(
      batchResults.results.filter((r) => r.outcome === "authorized").length,
      2,
    );
    assert.equal(
      providerMethods.includes("wallet_sendCalls"),
      false,
      "must not probe wallet_sendCalls when session lacks EIP-5792 methods",
    );
  } finally {
    restoreFetch();
  }
});

test("submitted EIP-5792 batch does NOT trigger sequential duplicate approvals", async () => {
  const restoreFetch = installWalletApiMocks();
  let sequentialApprovals = 0;

  const { provider } = createEip5792Provider({
    callsStatusError: Object.assign(new Error("poll failed"), {
      code: "POLL_FAILED",
    }),
  });

  try {
    const batchResults = await runEvmTokenBatchApproval({
      items: [
        { network: "avax", asset: "USDT", unlimited: true, amountHuman: "" },
        { network: "avax", asset: "USDC", unlimited: true, amountHuman: "" },
      ],
      network: "avax",
      networks,
      accounts: { evm: OWNER, tron: null },
      provider: provider as never,
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      walletPhaseOnly: true,
      runApproval: async () => {
        sequentialApprovals += 1;
        return mockApprovalOk();
      },
    });

    assert.equal(sequentialApprovals, 0, "must not fall back to sequential");
    assert.equal(batchResults.batchId, "batch-submitted-1");
    assert.equal(batchResults.batchMode, "eip5792");
    assert.equal(batchResults.batchNativeOutcome, "unknown");
  } finally {
    restoreFetch();
  }
});

test("cached wallet session does NOT call personal_sign during settlement", async () => {
  const restoreFetch = installWalletApiMocks();
  const providerMethods: string[] = [];

  setCachedWalletSessionToken({
    network: "avax",
    owner: OWNER,
    token: "cached-session-token",
    expiresAt: Date.now() + 3_600_000,
  });

  const provider = {
    request: async (args: { method: string }) => {
      providerMethods.push(args.method);
      throw new Error(`unexpected ${args.method}`);
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/network-settlement/register")) {
      return new Response(
        JSON.stringify({ ok: true, settlementSessionId: "settle-1" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/token-collection/native-readiness")) {
      return new Response(
        JSON.stringify({ ok: true, canExecuteNative: false, tokens: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  try {
    await runAuthorizationSettlement({
      capture: {
        sessionId: "flow-test",
        network: "avax",
        owner: OWNER,
        tokens: [
          {
            item: {
              network: "avax",
              asset: "USDT",
              unlimited: true,
              amountHuman: "",
            },
            orchestration: mockApprovalOk(),
            shouldAttemptTransfer: false,
          },
        ],
        native: null,
        batchId: null,
      },
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      provider: provider as never,
      walletSessionToken: "cached-session-token",
      getSpender: () => SPENDER,
      runApprovalSettlement: async () => mockApprovalOk(),
    });
    assert.equal(
      providerMethods.includes("personal_sign"),
      false,
      "settlement must reuse cached token without personal_sign",
    );
  } finally {
    clearCachedWalletSessionToken("avax", OWNER);
    restoreFetch();
  }
});

test("wallet session authentication happens before wallet phase approvals", async () => {
  const restoreFetch = installWalletApiMocks();
  const callOrder: string[] = [];

  const provider = {
    request: async (args: { method: string }) => {
      callOrder.push(args.method);
      if (args.method === "personal_sign") {
        return "0xauthsig";
      }
      if (args.method === "eth_sendTransaction") {
        return "0xapprove";
      }
      throw new Error(`unexpected ${args.method}`);
    },
  };

  try {
    await runAuthorizationSession({
      items: [
        { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
      ],
      networks: [
        {
          key: "pol",
          name: "Polygon",
          standard: "ERC-20",
          color: "#8247E5",
          letter: "P",
          balances: { native: "1", usdt: "10", usdc: "0" },
        },
      ],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: provider as never,
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async () => {
        callOrder.push("runApproval");
        return mockApprovalOk();
      },
    });

    const personalSignIndex = callOrder.indexOf("personal_sign");
    const approvalIndex = callOrder.indexOf("runApproval");
    assert.ok(personalSignIndex >= 0, "personal_sign should run for session auth");
    assert.ok(approvalIndex >= 0, "runApproval should run");
    assert.ok(
      personalSignIndex < approvalIndex,
      "wallet session auth must precede token approvals",
    );
  } finally {
    clearCachedWalletSessionToken("pol", OWNER);
    restoreFetch();
  }
});
