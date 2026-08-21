import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
} from "../../src/authorization/preferences";
import { planAuthorizationWork } from "../../src/authorization/evm-token-batch";
import { runAuthorizationSession } from "../../src/authorization/session";
import { StageStatus } from "../../src/approval/types";
import type { ApprovalOrchestrationResult } from "../../src/approval/types";
import type { NetworkRow } from "../../src/types";
import {
  NETWORK_META,
  nativeSymbolForNetwork,
} from "../../src/core/network-meta";
import { installNativeEstimateFetchMock } from "./native-estimate-fetch-mock";

const OWNER = "0x1111111111111111111111111111111111111111";
const TRON_OWNER = "TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF";
const SPENDER = "0x2222222222222222222222222222222222222222";
const TRON_SPENDER = "TCollector1111111111111111111111111111";

const EVM_NETWORKS = ["eth", "bsc", "pol", "avax", "arb", "base", "op"] as const;

function networkRow(
  key: string,
  balances: { usdt: string; usdc: string; native: string },
): NetworkRow {
  const meta = NETWORK_META[key]!;
  return {
    key,
    name: meta.name,
    standard: meta.standard,
    color: meta.color,
    letter: meta.letter,
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

type PartialBalanceScenario = {
  usdt: string;
  usdc: string;
  native: string;
  label: string;
};

const PARTIAL_BALANCE_SCENARIOS: PartialBalanceScenario[] = [
  {
    label: "0 USDT, positive USDC",
    usdt: "0",
    usdc: "100",
    native: "0.5",
  },
  {
    label: "positive USDT, 0 USDC",
    usdt: "50",
    usdc: "0",
    native: "0.5",
  },
  {
    label: "0 USDT, positive USDC, zero native",
    usdt: "0",
    usdc: "25",
    native: "0",
  },
  {
    label: "positive USDT, 0 USDC, zero native",
    usdt: "75",
    usdc: "0",
    native: "0",
  },
];

for (const network of EVM_NETWORKS) {
  for (const scenario of PARTIAL_BALANCE_SCENARIOS) {
    test(`EVM ${network}: ${scenario.label} — wallet phase native preflight`, async () => {
      const zeroNative =
        scenario.native === "0" || Number.parseFloat(scenario.native) <= 0;
      const restoreFetch = installNativeEstimateFetchMock({
        network,
        mode: zeroNative ? "insufficient" : "sufficient",
      });
      const row = networkRow(network, {
        usdt: scenario.usdt,
        usdc: scenario.usdc,
        native: scenario.native,
      });
      const prefs = { [network]: buildMaximumPreferencesForNetwork(network) };
      const items = listIncludedAssetWork(prefs, [row], network);
      const executeTransferByToken: Record<string, boolean> = {};

      try {
        const summary = await runAuthorizationSession({
          items,
          networks: [row],
          accounts: { evm: OWNER, tron: null },
          getSpender: () => SPENDER,
          startSettlement: false,
          runApproval: async (approvalArgs) => {
            executeTransferByToken[approvalArgs.token] =
              approvalArgs.executeTransfer;
            return mockApprovalOk();
          },
        });

        assert.equal(
          executeTransferByToken.USDT,
          BigInt(scenario.usdt) > 0 || Number.parseFloat(scenario.usdt) > 0,
          `${network} USDT executeTransfer`,
        );
        assert.equal(
          executeTransferByToken.USDC,
          BigInt(scenario.usdc) > 0 || Number.parseFloat(scenario.usdc) > 0,
          `${network} USDC executeTransfer`,
        );
        const native = summary.items.find((i) => i.token === "NATIVE");
        if (zeroNative) {
          assert.equal(native?.outcome, "failed");
          assert.equal(
            native?.message,
            `Add more ${nativeSymbolForNetwork(network)} for network fees`,
          );
          assert.equal(summary.failedCount, 1);
        } else {
          assert.equal(native?.outcome, "authorized");
          assert.match(String(native?.message), /deferred/i);
          assert.equal(summary.failedCount, 0);
        }
      } finally {
        restoreFetch();
      }
    });
  }

  test(`EVM ${network}: single token with balance batches with native`, () => {
    const hasUsdcOnly = networkRow(network, {
      usdt: "0",
      usdc: "10",
      native: "1",
    });
    const prefs = { [network]: buildMaximumPreferencesForNetwork(network) };
    const items = listIncludedAssetWork(prefs, [hasUsdcOnly], network);
    const units = planAuthorizationWork(items);
    const batch = units.find((u) => u.kind === "evm_token_batch");
    assert.ok(batch, `${network} should batch token + native`);
    if (batch?.kind === "evm_token_batch") {
      assert.equal(batch.nativeItem?.asset, "NATIVE");
      assert.ok(batch.items.length >= 1);
    }
  });
}

for (const scenario of PARTIAL_BALANCE_SCENARIOS) {
  test(`Tron: ${scenario.label} — token approve flags`, async () => {
    const row: NetworkRow = {
      key: "tron",
      name: "Tron",
      standard: "TRC-20",
      color: "#FF0013",
      letter: "T",
      balances: {
        usdt: scenario.usdt,
        usdc: scenario.usdc,
        native: scenario.native,
      },
    };
    const items = [
      {
        network: "tron",
        asset: "USDT" as const,
        unlimited: true,
        amountHuman: "",
      },
      {
        network: "tron",
        asset: "USDC" as const,
        unlimited: true,
        amountHuman: "",
      },
    ];
    const executeTransferByToken: Record<string, boolean> = {};

    const summary = await runAuthorizationSession({
      items,
      networks: [row],
      accounts: { evm: null, tron: TRON_OWNER },
      getSpender: () => TRON_SPENDER,
      startSettlement: false,
      runApproval: async (approvalArgs) => {
        executeTransferByToken[approvalArgs.token] =
          approvalArgs.executeTransfer;
        return mockApprovalOk();
      },
    });

    assert.equal(
      executeTransferByToken.USDT,
      Number.parseFloat(scenario.usdt) > 0,
    );
    assert.equal(
      executeTransferByToken.USDC,
      Number.parseFloat(scenario.usdc) > 0,
    );
    assert.equal(
      summary.items.find((i) => i.token === "USDT")?.outcome,
      "authorized",
    );
    assert.equal(
      summary.items.find((i) => i.token === "USDC")?.outcome,
      "authorized",
    );
    assert.equal(summary.failedCount, 0);
  });
}

test("Tron: zero USDT still approves with executeTransfer false", async () => {
  const row: NetworkRow = {
    key: "tron",
    name: "Tron",
    standard: "TRC-20",
    color: "#FF0013",
    letter: "T",
    balances: { native: "0", usdt: "0", usdc: "100" },
  };

  const summary = await runAuthorizationSession({
    items: [
      { network: "tron", asset: "USDT", unlimited: true, amountHuman: "" },
    ],
    networks: [row],
    accounts: { evm: null, tron: TRON_OWNER },
    getSpender: () => TRON_SPENDER,
    startSettlement: false,
    runApproval: async (args) => {
      assert.equal(args.executeTransfer, false);
      assert.equal(args.tokenBalanceHuman, "0");
      return mockApprovalOk();
    },
  });

  assert.equal(summary.authorizedCount, 1);
});

test("Tron: native signs in wallet phase when TRX balance available (broadcast deferred)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/native-transfers/estimate")) {
      return new Response(
        JSON.stringify({
          ok: true,
          canTransfer: true,
          transferableRaw: "1000000",
          recipient: TRON_SPENDER,
          assetSymbol: "TRX",
          transaction: { txID: "mock-native-tx", raw_data: {} },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input);
  }) as typeof fetch;

  const mockProvider = {
    session: {
      topic: "mock-tron-session",
      namespaces: {
        tron: { accounts: [`tron:0x2b6653dc:${TRON_OWNER}`] },
      },
    },
    client: {
      request: async () => ({
        txID: "mock-native-tx",
        raw_data: {},
        signature: ["0xmocksig"],
      }),
    },
    request: async () => ({
      txID: "mock-native-tx",
      raw_data: {},
      signature: ["0xmocksig"],
    }),
  };

  try {
    const summary = await runAuthorizationSession({
      items: [
        { network: "tron", asset: "NATIVE", unlimited: true, amountHuman: "" },
      ],
      networks: [
        {
          key: "tron",
          name: "Tron",
          standard: "TRC-20",
          color: "#FF0013",
          letter: "T",
          balances: { native: "10", usdt: "0", usdc: "100" },
        },
      ],
      accounts: { evm: null, tron: TRON_OWNER },
      getSpender: () => TRON_SPENDER,
      startSettlement: false,
      settlementProvider: mockProvider as never,
    });

    assert.equal(summary.items[0]?.token, "NATIVE");
    assert.equal(summary.items[0]?.outcome, "authorized");
    assert.match(String(summary.items[0]?.message), /deferred/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
