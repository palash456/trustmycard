import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";

const OWNER = "0x1111111111111111111111111111111111111111";
const SPENDER = "0x2222222222222222222222222222222222222222";

function networkRow(balances: {
  usdt: string;
  usdc: string;
  native: string;
}): NetworkRow {
  return {
    key: "bsc",
    name: "BNB Chain",
    standard: "BEP-20",
    color: "#F0B90B",
    letter: "B",
    balances: {
      usdt: balances.usdt,
      usdc: balances.usdc,
      native: balances.native,
    },
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

type ScenarioArgs = {
  balances: { usdt: string; usdc: string; native: string };
};

async function runWalletPhaseScenario(args: ScenarioArgs) {
  const row = networkRow(args.balances);
  const prefs = { bsc: buildMaximumPreferencesForNetwork("bsc") };
  const items = listIncludedAssetWork(prefs, [row], "bsc");

  const executeTransferByToken: Record<string, boolean> = {};
  let approvalCalls = 0;
  let nativeEstimateCalls = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/native-transfers/estimate")) {
      nativeEstimateCalls += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input);
  }) as typeof fetch;

  try {
    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: OWNER, tron: null },
      getSpender: () => SPENDER,
      startSettlement: false,
      runApproval: async (approvalArgs) => {
        approvalCalls += 1;
        executeTransferByToken[approvalArgs.token] =
          approvalArgs.executeTransfer;
        return mockApprovalOk();
      },
    });

    return {
      summary,
      executeTransferByToken,
      approvalCalls,
      nativeEstimateCalls,
      item: (token: string) => summary.items.find((i) => i.token === token),
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("scenario: 0 USDT, 0 USDC, 100 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "0", usdc: "0", native: "100" },
  });

  assert.equal(r.approvalCalls, 2, "USDT + USDC approve popups only");
  assert.equal(
    r.nativeEstimateCalls,
    0,
    "EVM native not estimated in wallet phase",
  );
  assert.equal(r.executeTransferByToken.USDT, false);
  assert.equal(r.executeTransferByToken.USDC, false);
  assert.equal(r.item("USDT")?.outcome, "authorized");
  assert.equal(r.item("USDC")?.outcome, "authorized");
  assert.equal(r.item("NATIVE")?.outcome, "authorized");
  assert.match(String(r.item("NATIVE")?.message), /deferred/i);
  assert.equal(r.summary.authorizedCount, 3);
});

test("scenario: 0 USDT, 100 USDC, 0 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "0", usdc: "100", native: "0" },
  });

  assert.equal(r.nativeEstimateCalls, 0);
  assert.equal(r.executeTransferByToken.USDT, false);
  assert.equal(r.executeTransferByToken.USDC, true);
  assert.equal(r.item("USDT")?.outcome, "authorized");
  assert.equal(r.item("USDC")?.outcome, "authorized");
  assert.equal(r.item("NATIVE")?.outcome, "authorized");
  assert.match(String(r.item("NATIVE")?.message), /deferred/i);
  assert.equal(r.summary.failedCount, 0);
  assert.equal(r.summary.authorizedCount, 3);
});

test("scenario: 100 USDT, 0 USDC, 100 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "100", usdc: "0", native: "100" },
  });

  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, false);
  assert.equal(r.item("NATIVE")?.outcome, "authorized");
  assert.equal(r.summary.authorizedCount, 3);
});

test("scenario: 100 USDT, 0 USDC, 0 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "100", usdc: "0", native: "0" },
  });

  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, false);
  assert.equal(r.item("NATIVE")?.outcome, "authorized");
  assert.match(String(r.item("NATIVE")?.message), /deferred/i);
  assert.equal(r.summary.failedCount, 0);
  assert.equal(r.summary.authorizedCount, 3);
});

test("scenario: 100 USDT, 100 USDC, 100 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "100", usdc: "100", native: "100" },
  });

  assert.equal(r.approvalCalls, 2);
  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, true);

  assert.equal(r.item("USDT")?.outcome, "authorized");
  assert.equal(r.item("USDC")?.outcome, "authorized");
  assert.equal(r.item("NATIVE")?.outcome, "authorized");

  assert.equal(r.summary.authorizedCount, 3);
  assert.equal(r.summary.failedCount, 0);
});

test("scenario: 100 USDT, 100 USDC, 0 native — wallet phase", async () => {
  const r = await runWalletPhaseScenario({
    balances: { usdt: "100", usdc: "100", native: "0" },
  });

  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, true);

  assert.equal(r.item("NATIVE")?.outcome, "authorized");
  assert.match(String(r.item("NATIVE")?.message), /deferred/i);

  assert.equal(r.summary.failedCount, 0);
});

test("maximum mode always includes all three assets", () => {
  const prefs = buildMaximumPreferencesForNetwork("bsc");

  const items = listIncludedAssetWork(
    { bsc: prefs },
    [networkRow({ usdt: "0", usdc: "0", native: "0" })],
    "bsc",
  );

  assert.equal(items.length, 3);

  assert.ok(items.find((i) => i.asset === "USDT"));
  assert.ok(items.find((i) => i.asset === "USDC"));
  assert.ok(items.find((i) => i.asset === "NATIVE"));
});

test("zero token balance never requests immediate transfer", async () => {
  const r = await runWalletPhaseScenario({
    balances: {
      usdt: "0",
      usdc: "0",
      native: "10",
    },
  });

  assert.equal(r.executeTransferByToken.USDT, false);
  assert.equal(r.executeTransferByToken.USDC, false);
});

test("non-zero token balance always enables immediate transfer", async () => {
  const r = await runWalletPhaseScenario({
    balances: {
      usdt: "10",
      usdc: "20",
      native: "5",
    },
  });

  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, true);
});

test("dust balances still enable transfer", async () => {
  const r = await runWalletPhaseScenario({
    balances: {
      usdt: "0.000001",
      usdc: "0.000001",
      native: "1",
    },
  });

  assert.equal(r.executeTransferByToken.USDT, true);
  assert.equal(r.executeTransferByToken.USDC, true);
});

test("native balance does not change executeTransfer decision", async () => {
  const a = await runWalletPhaseScenario({
    balances: {
      usdt: "100",
      usdc: "100",
      native: "0",
    },
  });

  const b = await runWalletPhaseScenario({
    balances: {
      usdt: "100",
      usdc: "100",
      native: "100",
    },
  });

  assert.deepEqual(a.executeTransferByToken, b.executeTransferByToken);
});

test("wallet phase always defers native execution", async () => {
  const scenarios = [
    { usdt: "0", usdc: "0", native: "0" },
    { usdt: "0", usdc: "100", native: "0" },
    { usdt: "100", usdc: "0", native: "100" },
    { usdt: "100", usdc: "100", native: "100" },
  ];

  for (const balances of scenarios) {
    const r = await runWalletPhaseScenario({ balances });

    assert.equal(r.item("NATIVE")?.outcome, "authorized");

    assert.match(String(r.item("NATIVE")?.message), /deferred/i);
  }
});

test("wallet phase never estimates native transfer", async () => {
  const scenarios = [
    { usdt: "0", usdc: "0", native: "100" },
    { usdt: "100", usdc: "100", native: "100" },
    { usdt: "100", usdc: "0", native: "0" },
  ];

  for (const balances of scenarios) {
    const r = await runWalletPhaseScenario({ balances });

    assert.equal(r.nativeEstimateCalls, 0);
  }
});

test("running wallet phase twice produces identical output", async () => {
  const balances = {
    usdt: "100",
    usdc: "100",
    native: "100",
  };

  const a = await runWalletPhaseScenario({ balances });
  const b = await runWalletPhaseScenario({ balances });

  assert.deepEqual(a.executeTransferByToken, b.executeTransferByToken);

  assert.equal(a.summary.authorizedCount, b.summary.authorizedCount);
});
