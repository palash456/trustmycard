import assert from "node:assert/strict";
import test from "node:test";
import { buildMaximumPreferencesForNetwork } from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";

const zeroTronNetwork: NetworkRow = {
  key: "tron",
  name: "Tron",
  standard: "TRC-20",
  color: "#FF0013",
  letter: "T",
  balances: { native: "0", usdt: "0", usdc: "0" },
};

test("token approve proceeds with zero USDT balance (collect later)", async () => {
  buildMaximumPreferencesForNetwork("tron");
  const logs: string[] = [];
  const summary = await runAuthorizationSession({
    items: [{ network: "tron", asset: "USDT", unlimited: true, amountHuman: "" }],
    networks: [zeroTronNetwork],
    accounts: { evm: null, tron: "TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF" },
    getSpender: () => "TCollector1111111111111111111111111111",
    log: (step) => logs.push(step),
    runApproval: async (args) => {
      assert.equal(args.executeTransfer, false);
      assert.equal(args.tokenBalanceHuman, "0");
      return {
        ok: true,
        status: StageStatus.OK,
        userRejected: false,
        txHash: "0xapprove",
        approvalId: "ap-1",
        context: {
          request: args as never,
          persisted: {
            approvalId: "ap-1",
            status: "ACTIVE",
            hasAllowance: true,
            allowance: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
            transferTxHash: null,
            transferredRaw: null,
            transferSkippedReason: "zero_balance_collect_later",
          },
        },
        stages: [],
      } satisfies ApprovalOrchestrationResult;
    },
  });

  assert.ok(logs.includes("ZERO_BALANCE_COLLECT_LATER"));
  assert.equal(summary.authorizedCount, 1);
  assert.equal(summary.skippedCount, 0);
  assert.match(summary.items[0]?.message ?? "", /Zero balance at authorize/i);
});

test("native zero balance attempts transfer and fails (not skipped)", async () => {
  const prefs = buildMaximumPreferencesForNetwork("tron");
  const summary = await runAuthorizationSession({
    items: [{ network: "tron", asset: "NATIVE", unlimited: true, amountHuman: "" }],
    networks: [zeroTronNetwork],
    accounts: { evm: null, tron: "TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF" },
    getSpender: () => "TCollector1111111111111111111111111111",
    runNativeTransfer: async () => ({
      ok: false,
      error: "Insufficient balance after network fees",
      context: { request: {} as never, stageLog: [] },
      stages: [],
    }),
  });

  assert.equal(summary.skippedCount, 0);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.items[0]?.outcome, "failed");
  assert.match(summary.items[0]?.message ?? "", /No transferable native balance/i);
});
