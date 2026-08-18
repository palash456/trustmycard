import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import {
  buildInsufficientNativeEstimate,
  installNativeEstimateFetchMock,
} from "./native-estimate-fetch-mock";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";

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

function avaxRow(balances: { usdt: string; usdc: string; native: string }) {
  return {
    key: "avax" as const,
    name: "Avalanche",
    standard: "ERC-20",
    color: "#E84142",
    letter: "A",
    balances,
  };
}

import {
  installNativeEstimateFetchMock,
  buildInsufficientNativeEstimate,
} from "./native-estimate-fetch-mock";

test("EVM dust native fails in wallet phase before settlement defer", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    mode: "insufficient",
    estimate: buildInsufficientNativeEstimate({
      network: "avax",
      owner: OWNER,
      recipient: SPENDER,
    }),
  });
  const row = avaxRow({ usdt: "0", usdc: "0", native: "0.0000396336598728" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  const logEvents: string[] = [];

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      apiBaseUrl: "http://localhost:3000",
      log: (step) => logEvents.push(step),
      runApproval: async () => mockApprovalOk(),
    });

    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "failed");
    assert.equal(native?.message, "Add more AVAX for network fees");
    assert.ok(logEvents.includes("NATIVE_PREFLIGHT_INSUFFICIENT"));
    assert.equal(logEvents.includes("NATIVE DEFERRED TO SETTLEMENT"), false);
  } finally {
    restoreFetch();
  }
});

test("EVM sufficient native still defers to settlement after preflight", async () => {
  const restoreFetch = installNativeEstimateFetchMock({
    network: "avax",
    mode: "sufficient",
  });
  const row = avaxRow({ usdt: "10", usdc: "5", native: "1" });
  const prefs = { avax: buildMaximumPreferencesForNetwork("avax") };
  const items = listIncludedAssetWork(prefs, [row], "avax");
  const logEvents: string[] = [];

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      apiBaseUrl: "http://localhost:3000",
      log: (step) => logEvents.push(step),
      runApproval: async () => mockApprovalOk(),
    });

    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.equal(native?.outcome, "authorized");
    assert.match(String(native?.message), /deferred/i);
    assert.ok(logEvents.includes("NATIVE DEFERRED TO SETTLEMENT"));
  } finally {
    restoreFetch();
  }
});
