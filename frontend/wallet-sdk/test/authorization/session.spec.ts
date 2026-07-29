import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCollectionModeForNetwork,
  buildMaximumPreferences,
  buildMaximumPreferencesForNetwork,
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

test("buildMaximumPreferencesForNetwork includes USDT and USDC for that network only", () => {
  const pol = buildMaximumPreferencesForNetwork("pol");
  assert.equal(pol.USDT?.included, true);
  assert.equal(pol.USDT?.mode, "maximum");
  assert.equal(pol.USDC?.included, true);

  const prefs = buildMaximumPreferences(networks);
  assert.equal(prefs.pol?.USDT?.included, true);
  assert.equal(prefs.tron?.USDT?.included, true);
});

test("listIncludedTokenWork is scoped to the selected network", () => {
  const prefs = buildMaximumPreferences(networks);
  prefs.pol!.USDC = { included: false, mode: "custom", amountHuman: "" };
  prefs.pol!.USDT = {
    included: true,
    mode: "custom",
    amountHuman: "25",
  };

  const polOnly = listIncludedTokenWork(prefs, networks, "pol");
  assert.deepEqual(
    polOnly.map((i) => `${i.network}:${i.token}:${i.unlimited}:${i.amountHuman}`),
    ["pol:USDT:false:25"]
  );

  const tronOnly = listIncludedTokenWork(prefs, networks, "tron");
  assert.equal(tronOnly.length, 2);
  assert.ok(tronOnly.every((i) => i.network === "tron"));
  assert.equal(validateIncludedPrefs(polOnly), null);
});

test("applyCollectionModeForNetwork does not mutate other networks", () => {
  let prefs = buildMaximumPreferences(networks);
  prefs = applyCollectionModeForNetwork("custom", "pol", prefs);
  // Switching to custom preserves prior token rows for that network, but scopes edits.
  assert.equal(prefs.pol?.USDT?.included, true);
  assert.equal(prefs.tron?.USDT?.included, true);
  assert.equal(prefs.tron?.USDT?.mode, "maximum");

  prefs = applyCollectionModeForNetwork("maximum", "tron", prefs);
  assert.equal(prefs.tron?.USDC?.mode, "maximum");
  assert.equal(prefs.pol?.USDT?.included, true);
});

test("runAuthorizationSession continues after one asset fails", async () => {
  const prefs = buildMaximumPreferences(networks);
  const items = listIncludedTokenWork(prefs, networks, "pol");

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
