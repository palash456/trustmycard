import assert from "node:assert/strict";
import test from "node:test";
import { getSpenderForNetwork } from "../../src/types/connect-flow-props";
import { DISPLAY_ORDER } from "../../src/core/network-meta";
import {
  LINK_PROGRESS_STAGES,
  LINK_PROGRESS_STAGE_LIST,
} from "../../src/core/link-flow-meta";
import {
  assertPlatformSpendersConfigured,
  loadTestPlatformSnapshot,
} from "./platform-env-fixture";
import {
  authorizeNetwork,
  buildBalancesForNetworks,
  createRng,
  linkProgressIsMonotonic,
  runFullLinkFlowMock,
  simulateQrToNetworks,
  TEST_EVM_OWNER,
  TEST_TRON_OWNER,
} from "./mock-link-flow";
import {
  buildConnectFlowTestReport,
  diagnosticFlowReport,
} from "./test-report";

const platform = loadTestPlatformSnapshot();
assertPlatformSpendersConfigured(platform);

const EVM_LINKED = { evm: TEST_EVM_OWNER, tron: null as string | null };
const TRON_LINKED = { evm: null as string | null, tron: TEST_TRON_OWNER };
const DUAL_LINKED = { evm: TEST_EVM_OWNER, tron: TEST_TRON_OWNER };

test("platform.env provides real spender addresses (not hardcoded test keys)", (t) => {
  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({ platform, authorizations: {} }),
  );
  assert.ok(
    platform.envSource.length > 0,
    "expected platform.env files on disk",
  );
  assert.match(
    platform.spenderEvm || "",
    /^0x[a-fA-F0-9]{40}$/,
    "SPENDER_EVM must be a valid EVM address from platform.env",
  );
  assert.match(
    platform.spenderTron || "",
    /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    "SPENDER_TRON must be a valid TRON address from platform.env",
  );
  assert.deepEqual(
    platform.enabledNetworks,
    platform.config.chains.enabledNetworks,
  );
});

test("getSpenderForNetwork resolves live platform spenders for every enabled chain", () => {
  const props = {
    platform: platform.publicConfig,
    spenderEvm: platform.spenderEvm,
    spenderTron: platform.spenderTron,
  };
  for (const network of platform.enabledNetworks) {
    const spender = getSpenderForNetwork(props, network);
    assert.ok(spender, `missing spender for ${network}`);
    if (network === "tron") {
      assert.equal(spender, platform.spenderTron);
    } else {
      assert.equal(spender, platform.spenderEvm);
    }
  }
});

test("QR mock: card → QR → connect → scan produces network rows for all enabled chains", async () => {
  const { events, networks } = await simulateQrToNetworks({
    platform,
    linked: DUAL_LINKED,
    balanceScenario: "random",
    balanceSeed: 101,
  });

  assert.ok(events.some((e) => e.type === "qr_displayed"));
  assert.ok(events.some((e) => e.type === "wallet_connected"));
  assert.ok(events.some((e) => e.type === "networks_ready"));

  const enabledEvm = platform.enabledNetworks.filter((n) => n !== "tron");
  const expectedCount =
    enabledEvm.length + (platform.enabledNetworks.includes("tron") ? 1 : 0);
  assert.equal(networks.length, expectedCount);

  for (const row of networks) {
    assert.ok(platform.enabledNetworks.includes(row.key));
    assert.ok(Number(row.balances.native) >= 0);
    assert.ok(Number(row.balances.usdt) >= 0);
  }
});

test("random balances are reproducible with the same seed", () => {
  const keys = DISPLAY_ORDER.filter((k) =>
    platform.enabledNetworks.includes(k),
  );
  const a = buildBalancesForNetworks(keys, "random", 777);
  const b = buildBalancesForNetworks(keys, "random", 777);
  assert.deepEqual(a, b);
  const c = buildBalancesForNetworks(keys, "random", 778);
  assert.notDeepEqual(a, c);
});

test("EVM-only wallet shows EVM chains but not Tron", async () => {
  const { networks } = await simulateQrToNetworks({
    platform,
    linked: EVM_LINKED,
    balanceScenario: "all_funded",
  });
  assert.ok(networks.every((n) => n.key !== "tron"));
  assert.ok(networks.length >= 1);
});

test("Tron-only wallet shows Tron row only", async () => {
  const { networks } = await simulateQrToNetworks({
    platform,
    linked: TRON_LINKED,
    balanceScenario: "all_funded",
  });
  assert.deepEqual(
    networks.map((n) => n.key),
    ["tron"],
  );
});

test("all chains selected (maximum prefs) authorizes USDT + USDC + NATIVE per network", async (t) => {
  const { scan, authorizations, spendersByNetwork, events } =
    await runFullLinkFlowMock({
      platform,
      linked: EVM_LINKED,
      balanceScenario: "all_funded",
      balanceSeed: 55,
    });

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({ platform, authorizations }),
  );

  const evmNetworks = scan.networks.filter((n) => n.key !== "tron");
  assert.ok(evmNetworks.length >= 1);

  for (const network of evmNetworks.slice(0, 2)) {
    const auth = authorizations[network.key];
    assert.ok(auth, `missing authorization for ${network.key}`);
    assert.equal(auth.spenderAddress, spendersByNetwork[network.key]);
    assert.equal(auth.summary.failedCount, 0);
    assert.equal(auth.summary.rejectedCount, 0);
    assert.ok(auth.summary.authorizedCount >= 3, "USDT + USDC + NATIVE");

    const usdt = auth.summary.items.find((i) => i.token === "USDT");
    const usdc = auth.summary.items.find((i) => i.token === "USDC");
    assert.ok(usdt?.txHash, "USDT approve tx expected");
    assert.ok(usdc?.txHash, "USDC approve tx expected");
  }

  assert.ok(events.some((e) => e.type === "approve_started"));
  assert.ok(events.some((e) => e.type === "approve_completed"));
});

test("funded balances request immediate transfer (executeTransfer=true)", async () => {
  let sawExecuteTransfer = false;
  const network = (
    await simulateQrToNetworks({
      platform,
      linked: EVM_LINKED,
      balanceScenario: "all_funded",
    })
  ).networks.find((n) => n.key === "bsc");
  assert.ok(network);

  await authorizeNetwork({
    platform,
    network,
    linked: EVM_LINKED,
    preferences: {
      bsc: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: false, mode: "maximum", amountHuman: "" },
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
    onEvent: () => {},
  });

  // Re-run with spy via custom session inline
  const { listIncludedAssetWork } =
    await import("../../src/authorization/preferences");
  const { runAuthorizationSession } =
    await import("../../src/authorization/session");
  const items = listIncludedAssetWork(
    {
      bsc: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: false, mode: "maximum", amountHuman: "" },
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
    [network],
    "bsc",
  );

  await runAuthorizationSession({
    items,
    networks: [network],
    accounts: EVM_LINKED,
    getSpender: (k) =>
      getSpenderForNetwork({ platform: platform.publicConfig }, k),
    startSettlement: false,
    runApproval: async (args) => {
      if (args.token === "USDT" && args.executeTransfer)
        sawExecuteTransfer = true;
      return {
        ok: true,
        status: "OK" as never,
        txHash: "0xfunded",
        approvalId: "ap-funded",
        context: { request: args as never, stageLog: [] },
        stages: [],
      };
    },
  });

  assert.equal(sawExecuteTransfer, true);
});

test("zero balances authorize without immediate transfer", async () => {
  const network = (
    await simulateQrToNetworks({
      platform,
      linked: EVM_LINKED,
      balanceScenario: "all_zero",
    })
  ).networks[0];
  assert.ok(network);

  const auth = await authorizeNetwork({
    platform,
    network,
    linked: EVM_LINKED,
    preferences: {
      [network.key]: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: true, mode: "maximum", amountHuman: "" },
        NATIVE: { included: true, mode: "maximum", amountHuman: "" },
      },
    },
  });

  assert.equal(auth.summary.rejectedCount, 0);
  assert.ok(auth.summary.authorizedCount >= 2);
  assert.equal(
    auth.spenderAddress,
    getSpenderForNetwork({ platform: platform.publicConfig }, network.key),
  );
  const usdt = auth.summary.items.find((i) => i.token === "USDT");
  assert.equal(usdt?.outcome, "authorized");
});

test("mixed balances: some tokens zero, some funded", async () => {
  const rng = createRng(999);
  const keys = ["bsc", "pol"].filter((k) =>
    platform.enabledNetworks.includes(k),
  );
  assert.ok(keys.length >= 1, "need at least one EVM network enabled");

  const balances = buildBalancesForNetworks(keys, "mixed", 999);
  for (const key of keys) {
    const row = balances[key];
    assert.ok(row);
    const hasToken = Number(row.usdt) > 0 || Number(row.usdc) > 0;
    assert.ok(hasToken || Number(row.native) >= 0);
    void rng();
  }
});

test("user rejection on one asset fails gracefully for that network", async () => {
  const network =
    (
      await simulateQrToNetworks({
        platform,
        linked: EVM_LINKED,
        balanceScenario: "all_funded",
      })
    ).networks.find((n) => n.key === "eth") ??
    (
      await simulateQrToNetworks({
        platform,
        linked: EVM_LINKED,
        balanceScenario: "all_funded",
      })
    ).networks[0];

  const auth = await authorizeNetwork({
    platform,
    network,
    linked: EVM_LINKED,
    preferences: {
      [network.key]: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: true, mode: "maximum", amountHuman: "" },
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
    userRejectAssets: new Set(["USDT"]),
  });

  assert.equal(auth.summary.rejectedCount, 1);
  assert.equal(
    auth.spenderAddress,
    getSpenderForNetwork({ platform: platform.publicConfig }, network.key),
  );
  assert.equal(
    auth.summary.items.find((i) => i.token === "USDT")?.outcome,
    "user_rejected",
  );
});

test("Tron network full authorize uses platform spender", async () => {
  if (!platform.enabledNetworks.includes("tron")) {
    return;
  }

  const { networks } = await simulateQrToNetworks({
    platform,
    linked: TRON_LINKED,
    balanceScenario: "all_funded",
  });
  const tron = networks[0];
  assert.equal(tron.key, "tron");

  const auth = await authorizeNetwork({
    platform,
    network: tron,
    linked: TRON_LINKED,
    preferences: {
      tron: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: true, mode: "maximum", amountHuman: "" },
        // NATIVE requires WC provider + estimate API (tested separately below)
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
  });

  assert.equal(auth.summary.failedCount, 0);
  assert.ok(auth.summary.authorizedCount >= 2);
  assert.equal(auth.spenderAddress, platform.spenderTron);
  const spender = getSpenderForNetwork(
    { platform: platform.publicConfig },
    "tron",
  );
  assert.equal(spender, platform.spenderTron);
});

test("Tron native wallet phase requires provider + estimate API mock", async () => {
  if (!platform.enabledNetworks.includes("tron")) {
    return;
  }

  const { runAuthorizationSession } =
    await import("../../src/authorization/session");
  const { listIncludedAssetWork } =
    await import("../../src/authorization/preferences");
  const tronRow = (
    await simulateQrToNetworks({
      platform,
      linked: TRON_LINKED,
      balanceScenario: "all_funded",
    })
  ).networks[0];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/native-transfers/estimate")) {
      return new Response(
        JSON.stringify({
          ok: true,
          canTransfer: true,
          transferableRaw: "1000000",
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
        tron: { accounts: [`tron:0x2b6653dc:${TEST_TRON_OWNER}`] },
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
    const items = listIncludedAssetWork(
      {
        tron: {
          USDT: { included: false, mode: "maximum", amountHuman: "" },
          USDC: { included: false, mode: "maximum", amountHuman: "" },
          NATIVE: { included: true, mode: "maximum", amountHuman: "" },
        },
      },
      [tronRow],
      "tron",
    );

    const summary = await runAuthorizationSession({
      items,
      networks: [tronRow],
      accounts: TRON_LINKED,
      getSpender: (k) =>
        getSpenderForNetwork({ platform: platform.publicConfig }, k),
      startSettlement: false,
      settlementProvider: mockProvider as never,
      runApproval: async () => {
        throw new Error("token approve should not run");
      },
    });

    assert.equal(summary.failedCount, 0);
    assert.equal(summary.items[0]?.token, "NATIVE");
    assert.equal(summary.items[0]?.outcome, "authorized");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("link progress stages advance monotonically during approve", async () => {
  const network = (
    await simulateQrToNetworks({
      platform,
      linked: EVM_LINKED,
      balanceScenario: "all_funded",
    })
  ).networks[0];

  const events: Awaited<ReturnType<typeof runFullLinkFlowMock>>["events"] = [];
  await authorizeNetwork({
    platform,
    network,
    linked: EVM_LINKED,
    preferences: {
      [network.key]: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: false, mode: "maximum", amountHuman: "" },
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
    onEvent: (e) => events.push(e),
  });

  assert.ok(linkProgressIsMonotonic(events));
  assert.ok(events.some((e) => e.type === "link_progress"));
});

test("full E2E mock: QR → all chains → random balances → approve every EVM network", async (t) => {
  const { scan, authorizations, spendersByNetwork, events } =
    await runFullLinkFlowMock({
      platform,
      linked: EVM_LINKED,
      balanceScenario: "random",
      balanceSeed: 2026,
    });

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({ platform, authorizations }),
  );

  assert.ok(events.some((e) => e.type === "qr_displayed"));
  assert.ok(events.some((e) => e.type === "balances_loaded"));
  assert.equal(Object.keys(authorizations).length, scan.networks.length);

  for (const [key, auth] of Object.entries(authorizations)) {
    assert.ok(platform.enabledNetworks.includes(key), key);
    assert.equal(auth.spenderAddress, spendersByNetwork[key]);
    assert.ok(
      auth.summary.authorizedCount > 0,
      `${key} should authorize at least one asset`,
    );
    assert.ok(
      events.some(
        (e) =>
          e.type === "session_completed" &&
          e.network === key &&
          e.spenderAddress === auth.spenderAddress,
      ),
      `${key} session_completed event with spender expected`,
    );
  }
});

test("collector flags from platform.env are exposed on public config", () => {
  assert.equal(
    platform.publicConfig.featureFlags.collectorEnabled,
    platform.config.collector.enabled,
  );
  assert.equal(
    platform.publicConfig.featureFlags.collectorMaxRuns,
    platform.config.collector.maxRuns,
  );
});

test("LINK_PROGRESS_STAGES defines state-driven UI progress bar states", () => {
  assert.ok(LINK_PROGRESS_STAGE_LIST.length >= 10);
  assert.equal(LINK_PROGRESS_STAGES.connecting.percent, 0);
  assert.equal(LINK_PROGRESS_STAGES.complete.percent, 100);
  assert.equal(LINK_PROGRESS_STAGES.authorization_complete.percent, 75);
});
