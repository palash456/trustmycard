import assert from "node:assert/strict";
import test from "node:test";
import { runAuthorizationSettlement } from "../../src/authorization/phases/settlement-coordinator";
import type { WalletPhaseCapture } from "../../src/authorization/phases/types";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";

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

function mockSettlementOk(): ApprovalOrchestrationResult {
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

function baseCapture(
  native?: WalletPhaseCapture["native"],
): WalletPhaseCapture {
  return {
    sessionId: "flow-batch-native-test",
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
        orchestration: mockSettlementOk(),
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
        orchestration: mockSettlementOk(),
        shouldAttemptTransfer: true,
        transferAmountRaw: "500000",
      },
    ],
    native,
    batchId: "batch-1",
  };
}

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

test("settlement skips native execution when EIP-5792 batch already included native", async () => {
  const restoreFetch = installSettlementFetchMock();
  let nativeTransferCalls = 0;

  try {
    const result = await runAuthorizationSettlement({
      capture: baseCapture({
        network: "avax",
        owner: OWNER,
        authorizationKind: "evm_batch_executed",
        authorizationPayload: { txHash: "0xnative-batch" },
        estimateTransferableRaw: "900000000000000000",
        recipient: SPENDER,
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      runApprovalSettlement: async () => mockSettlementOk(),
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
    assert.equal(nativeItem?.txHash, "0xnative-batch");
  } finally {
    restoreFetch();
  }
});

test("settlement does not re-prompt wallet when deferred EVM broadcast fails", async () => {
  const restoreFetch = installSettlementFetchMock();
  let nativeTransferCalls = 0;

  try {
    const result = await runAuthorizationSettlement({
      capture: baseCapture({
        network: "avax",
        owner: OWNER,
        authorizationKind: "evm_signed",
        authorizationPayload: { signedRaw: "0xsignedraw" },
        estimateTransferableRaw: "900000000000000000",
        recipient: SPENDER,
      }),
      networks,
      accounts: { evm: OWNER, tron: null },
      apiBaseUrl: "http://localhost:3000",
      getSpender: () => SPENDER,
      runApprovalSettlement: async () => mockSettlementOk(),
      runNativeTransfer: async (args) => {
        nativeTransferCalls += 1;
        assert.equal(args.mode, "execute_deferred");
        return {
          ok: false,
          error: "broadcast failed",
          userRejected: false,
          context: { request: {} as never, stageLog: [] },
          stages: [],
        };
      },
    });

    assert.equal(nativeTransferCalls, 1);
    assert.equal(result.ok, false);
    assert.match(String(result.error), /broadcast failed/i);
  } finally {
    restoreFetch();
  }
});
