import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import {
  isApprovalOrchestrationUserDenied,
  isUserDeniedStageResult,
} from "../../src/approval/resilience/errors";
import {
  cancelledStage,
  StageStatus,
  ApprovalStageName,
} from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";
import { NativeTransferOrchestrator } from "../../src/native-transfer/orchestrator";
import {
  NativeStageStatus,
  NativeTransferStageName,
} from "../../src/native-transfer/types";
import { isNativeEstimateInsufficient } from "../../src/native-transfer/native-wallet-authorize";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";

function avaxRow(balances: {
  usdt: string;
  usdc: string;
  native: string;
}): NetworkRow {
  return {
    key: "avax",
    name: "Avalanche",
    standard: "ERC-20",
    color: "#E84142",
    letter: "A",
    balances,
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

function createTrackingOrchestrator(options: {
  onRun?: () => void;
  result: Awaited<ReturnType<NativeTransferOrchestrator["run"]>>;
}): NativeTransferOrchestrator {
  return {
    resolveChain: () => null,
    run: async () => {
      options.onRun?.();
      return options.result;
    },
  } as NativeTransferOrchestrator;
}

const mockProvider = {
  request: async (args: { method: string }) => {
    if (args.method === "eth_chainId") return "0xa86a";
    if (args.method === "personal_sign") return "0xmocksig";
    throw new Error(`unexpected wallet method ${args.method}`);
  },
  session: {
    topic: "mock",
    namespaces: { eip155: { accounts: [`eip155:43114:${OWNER}`] } },
  },
};

import {
  installNativeEstimateFetchMock,
  buildSufficientNativeEstimate,
  buildInsufficientNativeEstimate,
} from "./native-estimate-fetch-mock";

test("isUserDeniedStageResult treats CANCELLED broadcast as user denial", () => {
  const cancelled = cancelledStage(ApprovalStageName.BROADCAST);
  assert.equal(isUserDeniedStageResult(cancelled), true);
  assert.equal(isApprovalOrchestrationUserDenied(cancelled), true);
});

test("cancelled approval orchestration maps to user_rejected in wallet phase", async () => {
  const row = avaxRow({ usdt: "0", usdc: "0", native: "0.01" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");

  const summary = await runAuthorizationSession({
    items,
    networks: [row],
    accounts: { evm: OWNER, tron: null },
    settlementProvider: mockProvider as never,
    getSpender: () => SPENDER,
    startSettlement: false,
    runApproval: async (args) => {
      if (args.token === "USDC") {
        return {
          ok: false,
          status: StageStatus.CANCELLED,
          failedStage: ApprovalStageName.BROADCAST,
          error: "Cancelled",
          userRejected: false,
          context: { request: {} as never, stageLog: [] },
          stages: [cancelledStage(ApprovalStageName.BROADCAST)],
        };
      }
      return mockApprovalOk();
    },
  });

  assert.equal(
    summary.items.find((i) => i.token === "USDC")?.outcome,
    "user_rejected",
  );
});

test("positive flow: sufficient native defers without wallet-phase orchestrator", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    estimate: buildSufficientNativeEstimate({
      network: "avax",
      owner: OWNER,
      recipient: SPENDER,
    }),
  });
  const row = avaxRow({ usdt: "10", usdc: "5", native: "1" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  let orchestratorRuns = 0;

  const orchestrator = createTrackingOrchestrator({
    onRun: () => {
      orchestratorRuns += 1;
    },
    result: {
      ok: true,
      context: {
        request: { network: "avax", owner: OWNER, traceId: "t1" },
        stageLog: [],
        estimate: buildSufficientNativeEstimate({
          network: "avax",
          owner: OWNER,
          recipient: SPENDER,
        }) as never,
      },
      stages: [],
      deferredSignedRaw: "0xsignednative",
      deferredTransferableRaw: "900000000000000000",
    },
  });

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: mockProvider as never,
      nativeOrchestrator: orchestrator,
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async () => mockApprovalOk(),
    });

    assert.equal(orchestratorRuns, 0);
    assert.equal(
      summary.items.find((i) => i.token === "NATIVE")?.outcome,
      "authorized",
    );
    assert.match(
      String(summary.items.find((i) => i.token === "NATIVE")?.message),
      /deferred/i,
    );
    assert.equal(summary.failedCount, 0);
  } finally {
    restoreFetch();
  }
});

test("zero-token wallet with zero native fails preflight without orchestrator sign attempt", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    mode: "insufficient",
    estimate: buildInsufficientNativeEstimate({
      network: "avax",
      owner: OWNER,
      recipient: SPENDER,
    }),
  });
  const row = avaxRow({ usdt: "0", usdc: "0", native: "0" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  let orchestratorRuns = 0;

  const orchestrator = createTrackingOrchestrator({
    onRun: () => {
      orchestratorRuns += 1;
    },
    result: {
      ok: false,
      error: "should not run",
      context: {
        request: { network: "avax", owner: OWNER, traceId: "t2" },
        stageLog: [],
      },
      stages: [],
    },
  });

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: mockProvider as never,
      nativeOrchestrator: orchestrator,
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async () => mockApprovalOk(),
    });

    assert.equal(orchestratorRuns, 0);
    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "failed");
    assert.equal(native?.message, "Add more AVAX for network fees");
  } finally {
    restoreFetch();
  }
});

test("isNativeEstimateInsufficient detects estimate-stage insufficient balance", () => {
  assert.equal(
    isNativeEstimateInsufficient({
      ok: false,
      error: "Insufficient balance after network fees",
      context: {
        request: { network: "avax", owner: OWNER, traceId: "t3" },
        stageLog: [],
        estimate: {
          network: "avax",
          owner: OWNER,
          recipient: SPENDER,
          assetSymbol: "AVAX",
          balanceRaw: "1",
          balanceHuman: "1",
          feeRaw: "2",
          feeHuman: "2",
          transferableRaw: "0",
          transferableHuman: "0",
          canTransfer: false,
        },
      },
      stages: [
        {
          stage: NativeTransferStageName.ESTIMATE,
          status: NativeStageStatus.FAILED,
          error: "Insufficient balance after network fees",
        },
      ],
    }),
    true,
  );
});

test("zero-token wallet with insufficient native estimate fails preflight without eth_signTransaction", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    mode: "insufficient",
    estimate: buildInsufficientNativeEstimate({
      network: "avax",
      owner: OWNER,
      recipient: SPENDER,
    }),
  });
  const row = avaxRow({ usdt: "0", usdc: "0", native: "0.00001" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");

  const orchestrator = createTrackingOrchestrator({
    result: {
      ok: false,
      error: "Insufficient balance after network fees",
      context: {
        request: { network: "avax", owner: OWNER, traceId: "t3" },
        stageLog: [],
        estimate: buildInsufficientNativeEstimate({
          network: "avax",
          owner: OWNER,
          recipient: SPENDER,
        }) as never,
      },
      stages: [
        {
          stage: NativeTransferStageName.ESTIMATE,
          status: NativeStageStatus.FAILED,
          error: "Insufficient balance after network fees",
        },
      ],
    },
  });

  let walletSignCalls = 0;
  const provider = {
    ...mockProvider,
    request: async (args: { method: string }) => {
      if (args.method === "eth_signTransaction") {
        walletSignCalls += 1;
      }
      return mockProvider.request(args);
    },
  };

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: provider as never,
      nativeOrchestrator: orchestrator,
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async () => mockApprovalOk(),
    });

    assert.equal(walletSignCalls, 0);
    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "failed");
    assert.equal(native?.message, "Add more AVAX for network fees");
    assert.equal(summary.failedCount, 1);
  } finally {
    restoreFetch();
  }
});

test("token approval cancellation skips native nonce wait dependency path", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    estimate: buildSufficientNativeEstimate({
      network: "avax",
      owner: OWNER,
      recipient: SPENDER,
    }),
  });
  const row = avaxRow({ usdt: "0", usdc: "0", native: "0.5" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  const logEvents: Array<{ step: string; detail?: Record<string, unknown> }> =
    [];

  let orchestratorRuns = 0;
  const orchestrator = createTrackingOrchestrator({
    onRun: () => {
      orchestratorRuns += 1;
    },
    result: {
      ok: true,
      context: {
        request: { network: "avax", owner: OWNER, traceId: "t4" },
        stageLog: [],
        estimate: {
          network: "avax",
          owner: OWNER,
          recipient: SPENDER,
          assetSymbol: "AVAX",
          balanceRaw: "1000000000000000000",
          balanceHuman: "0.5",
          feeRaw: "1",
          feeHuman: "1",
          transferableRaw: "999999999999999999",
          transferableHuman: "0.499",
          canTransfer: true,
          chainId: 43114,
        },
      },
      stages: [],
      deferredSignedRaw: "0xsigned",
      deferredTransferableRaw: "999999999999999999",
    },
  });

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      settlementProvider: mockProvider as never,
      nativeOrchestrator: orchestrator,
      getSpender: () => SPENDER,
      startSettlement: false,
      log: (step, detail) => logEvents.push({ step, detail }),
      runApproval: async (args) => {
        if (args.token === "USDC") {
          return {
            ok: false,
            status: StageStatus.CANCELLED,
            failedStage: ApprovalStageName.BROADCAST,
            error: "Cancelled",
            userRejected: false,
            context: { request: {} as never, stageLog: [] },
            stages: [cancelledStage(ApprovalStageName.BROADCAST)],
          };
        }
        return mockApprovalOk();
      },
    });

    assert.equal(
      logEvents.some((e) => e.step === "EVM_NATIVE_SIGN_NONCE_WAIT"),
      false,
    );
    assert.equal(orchestratorRuns, 0);
    assert.equal(
      summary.items.find((i) => i.token === "NATIVE")?.outcome,
      "skipped_dependency_failed",
    );
    assert.equal(
      summary.items.find((i) => i.token === "USDC")?.outcome,
      "user_rejected",
    );
  } finally {
    restoreFetch();
  }
});
