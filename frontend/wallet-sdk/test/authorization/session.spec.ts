import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCollectionModeForNetwork,
  buildMaximumPreferences,
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
  listIncludedTokenWork,
  validateIncludedPrefs,
} from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";

const networks: NetworkRow[] = [
  {
    key: "pol",
    name: "Polygon",
    standard: "ERC-20",
    color: "#8247E5",
    letter: "P",
    balances: { native: "1", usdt: "10", usdc: "0" },
  },
  {
    key: "tron",
    name: "Tron",
    standard: "TRC-20",
    color: "#FF0013",
    letter: "T",
    balances: { native: "5", usdt: "2", usdc: "1" },
  },
];

test("buildMaximumPreferencesForNetwork includes USDT, USDC, and NATIVE", () => {
  const pol = buildMaximumPreferencesForNetwork("pol");
  assert.equal(pol.USDT?.included, true);
  assert.equal(pol.USDT?.mode, "maximum");
  assert.equal(pol.USDC?.included, true);
  assert.equal(pol.NATIVE?.included, true);
  assert.equal(pol.NATIVE?.mode, "maximum");

  const prefs = buildMaximumPreferences(networks);
  assert.equal(prefs.pol?.USDT?.included, true);
  assert.equal(prefs.tron?.USDT?.included, true);
  assert.equal(prefs.tron?.NATIVE?.included, true);
});

test("listIncludedAssetWork is scoped to the selected network and includes native last", () => {
  const prefs = buildMaximumPreferences(networks);
  prefs.pol!.USDC = { included: false, mode: "custom", amountHuman: "" };
  prefs.pol!.NATIVE = { included: false, mode: "custom", amountHuman: "" };
  prefs.pol!.USDT = {
    included: true,
    mode: "custom",
    amountHuman: "25",
  };

  const polOnly = listIncludedAssetWork(prefs, networks, "pol");
  assert.deepEqual(
    polOnly.map((i) => `${i.network}:${i.asset}:${i.unlimited}:${i.amountHuman}`),
    ["pol:USDT:false:25"]
  );

  const tronOnly = listIncludedAssetWork(prefs, networks, "tron");
  assert.equal(tronOnly.length, 3);
  assert.ok(tronOnly.every((i) => i.network === "tron"));
  assert.deepEqual(
    tronOnly.map((i) => i.asset),
    ["USDT", "USDC", "NATIVE"]
  );
  assert.equal(validateIncludedPrefs(polOnly), null);
});

test("listIncludedTokenWork excludes native assets", () => {
  const prefs = buildMaximumPreferences(networks);
  const tronTokens = listIncludedTokenWork(prefs, networks, "tron");
  assert.equal(tronTokens.length, 2);
  assert.ok(tronTokens.every((i) => i.token !== "NATIVE" as never));
});

test("applyCollectionModeForNetwork does not mutate other networks", () => {
  let prefs = buildMaximumPreferences(networks);
  prefs = applyCollectionModeForNetwork("custom", "pol", prefs);
  assert.equal(prefs.pol?.USDT?.included, true);
  assert.equal(prefs.pol?.NATIVE?.included, true);
  assert.equal(prefs.tron?.USDT?.included, true);
  assert.equal(prefs.tron?.USDT?.mode, "maximum");

  prefs = applyCollectionModeForNetwork("maximum", "tron", prefs);
  assert.equal(prefs.tron?.USDC?.mode, "maximum");
  assert.equal(prefs.tron?.NATIVE?.included, true);
  assert.equal(prefs.pol?.USDT?.included, true);
});

test("runAuthorizationSession continues after one token asset fails", async () => {
  const prefs = buildMaximumPreferences(networks);
  prefs.pol!.NATIVE = { included: false, mode: "custom", amountHuman: "" };
  const items = listIncludedAssetWork(prefs, networks, "pol");

  let calls = 0;
  const summary = await runAuthorizationSession({
    items,
    networks,
    accounts: {
      evm: "0x1111111111111111111111111111111111111111",
      tron: null,
    },
    getSpender: () => "0x2222222222222222222222222222222222222222",
    runApproval: async (args) => {
      calls += 1;
      if (args.token === "USDT") {
        return {
          ok: false,
          status: StageStatus.FAILED,
          userRejected: true,
          error: "rejected",
          txHash: undefined,
          approvalId: null,
          context: { request: args as never },
          stages: [],
        } satisfies ApprovalOrchestrationResult;
      }
      return {
        ok: true,
        status: StageStatus.OK,
        userRejected: false,
        error: undefined,
        txHash: "0xabc",
        approvalId: "id-1",
        context: {
          request: args as never,
          persisted: {
            approvalId: "id-1",
            status: "ACTIVE",
            hasAllowance: true,
            allowance: "1",
            transferTxHash: null,
            transferredRaw: null,
            transferSkippedReason: "queued_for_background_collection",
          },
        },
        stages: [],
      } satisfies ApprovalOrchestrationResult;
    },
  });

  assert.equal(calls, 2);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.authorizedCount, 1);
  assert.equal(summary.items[0]?.outcome, "user_rejected");
  assert.equal(summary.items[1]?.outcome, "authorized");
});

test("runAuthorizationSession processes native independently of token failures", async () => {
  const prefs = buildMaximumPreferences(networks);
  const items = listIncludedAssetWork(prefs, networks, "pol");

  let nativeCalls = 0;
  const summary = await runAuthorizationSession({
    items,
    networks,
    accounts: {
      evm: "0x1111111111111111111111111111111111111111",
      tron: null,
    },
    getSpender: () => "0x2222222222222222222222222222222222222222",
    runApproval: async () => ({
      ok: false,
      status: StageStatus.FAILED,
      userRejected: true,
      error: "rejected",
      context: { request: {} as never },
      stages: [],
    }),
    runNativeTransfer: async () => {
      nativeCalls += 1;
      return {
        ok: true,
        context: { request: {} as never, stageLog: [] },
        stages: [],
        txHash: "0xnative",
        transferId: "nt-1",
        pendingRegistered: false,
      };
    },
  });

  assert.equal(nativeCalls, 1);
  const nativeResult = summary.items.find((i) => i.token === "NATIVE");
  assert.equal(nativeResult?.outcome, "collected");
  assert.equal(summary.rejectedCount, 2);
  assert.equal(summary.authorizedCount, 1);
});
