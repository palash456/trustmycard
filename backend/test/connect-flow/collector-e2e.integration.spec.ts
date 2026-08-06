import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPlatformSpendersConfigured,
  loadTestPlatformSnapshot,
  spenderForNetwork,
} from "./platform-env-fixture";
import {
  CollectorFlowMock,
  registerApprovalsFromAuthItems,
} from "./collector-flow-mock";

const platform = loadTestPlatformSnapshot();
assertPlatformSpendersConfigured(platform);

const OWNER = "0x1111111111111111111111111111111111111111";
const TRON_OWNER = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const FUNDED = { allowanceRaw: BigInt(10_000_000), balanceRaw: BigInt(5_000_000) };

test("collector mock uses platform.env spender on registered approval", () => {
  const mock = new CollectorFlowMock(platform);
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDT",
    approveTxHash: "0xapprove-usdt",
  });
  assert.equal(approval.spenderAddress, spenderForNetwork(platform, network));
});

test("collector runs transferFrom to platform spender when funded", () => {
  const mock = new CollectorFlowMock(platform);
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "bsc";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDT",
    approveTxHash: "0xapprove",
  });
  mock.setChainState(network, OWNER, "USDT", FUNDED);

  const result = mock.runCollector(approval.id);
  assert.ok(result?.txHash);
  assert.ok(result.transferredRaw !== "0");

  const transfer = mock.transfers[0];
  assert.ok(transfer);
  assert.equal(transfer.toAddress, spenderForNetwork(platform, network));
  assert.equal(transfer.fromAddress, OWNER);
  assert.equal(transfer.status, "confirmed");
  assert.ok(mock.events.some((e) => e.type === "transfer_from"));
});

test("zero balance: collector tick claims run but does not transfer", () => {
  const mock = new CollectorFlowMock(platform, { maxRuns: 3 });
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDC",
    approveTxHash: "0xapprove",
  });
  mock.setChainState(network, OWNER, "USDC", {
    allowanceRaw: BigInt(1_000_000),
    balanceRaw: BigInt(0),
  });

  const result = mock.runCollector(approval.id);
  assert.equal(result?.transferredRaw, "0");
  assert.equal(mock.transfers.length, 0);
  assert.equal(mock.approvals.get(approval.id)?.collectorRunCount, 1);
  assert.equal(mock.approvals.get(approval.id)?.collectionEnabled, true);
});

test("COLLECTOR_ENABLED=false skips all collection", () => {
  const mock = new CollectorFlowMock(platform, { collectorEnabled: false });
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDT",
    approveTxHash: "0xapprove",
  });
  mock.setChainState(network, OWNER, "USDT", FUNDED);

  const result = mock.runCollector(approval.id);
  assert.equal(result, null);
  assert.ok(mock.events.some((e) => e.type === "collector_disabled"));
  assert.equal(mock.approvals.get(approval.id)?.collectorRunCount, 0);
});

test("COLLECTOR_MAX_RUNS=1 allows exactly one collector tick", () => {
  const mock = new CollectorFlowMock(platform, { maxRuns: 1 });
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDT",
    approveTxHash: "0xapprove",
  });
  mock.setChainState(network, OWNER, "USDT", {
    allowanceRaw: BigInt(1_000_000),
    balanceRaw: BigInt(0),
  });

  mock.runCollector(approval.id);
  mock.runCollector(approval.id);

  assert.equal(mock.approvals.get(approval.id)?.collectorRunCount, 1);
  assert.equal(mock.approvals.get(approval.id)?.collectionEnabled, false);
  assert.equal(mock.approvals.get(approval.id)?.lastError, "COLLECTOR_MAX_RUNS_REACHED");
});

test("partial collection across multiple ticks until completed", () => {
  const mock = new CollectorFlowMock(platform, { maxRuns: null });
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "bsc";
  const approval = mock.registerApproval({
    network,
    owner: OWNER,
    token: "USDT",
    approveTxHash: "0xapprove",
    remainingRaw: BigInt(3_000_000),
    unlimited: false,
  });
  mock.setChainState(network, OWNER, "USDT", {
    allowanceRaw: BigInt(3_000_000),
    balanceRaw: BigInt(1_000_000),
  });

  const first = mock.runCollector(approval.id);
  assert.ok(first?.txHash);
  assert.equal(mock.approvals.get(approval.id)?.status, "PARTIALLY_USED");
  assert.equal(mock.approvals.get(approval.id)?.remainingRaw, "2000000");

  mock.setChainState(network, OWNER, "USDT", {
    allowanceRaw: BigInt(3_000_000),
    balanceRaw: BigInt(2_000_000),
  });

  const second = mock.runCollector(approval.id);
  assert.ok(second?.txHash);
  assert.equal(mock.approvals.get(approval.id)?.status, "COMPLETED");
  assert.equal(mock.approvals.get(approval.id)?.collectionEnabled, false);
});

test("Tron collector uses platform TRON spender", () => {
  if (!platform.enabledNetworks.includes("tron")) return;

  const mock = new CollectorFlowMock(platform);
  const approval = mock.registerApproval({
    network: "tron",
    owner: TRON_OWNER,
    token: "USDT",
    approveTxHash: "tron-approve-hash",
  });
  mock.setChainState("tron", TRON_OWNER, "USDT", FUNDED);

  const result = mock.runCollector(approval.id);
  assert.ok(result?.txHash);
  assert.equal(mock.transfers[0]?.toAddress, platform.spenderTron);
});

test("all enabled EVM networks collect with correct spender", () => {
  const evmNetworks = platform.enabledNetworks.filter((n) => n !== "tron");
  assert.ok(evmNetworks.length >= 1);

  for (const network of evmNetworks) {
    const mock = new CollectorFlowMock(platform);
    const approval = mock.registerApproval({
      network,
      owner: OWNER,
      token: "USDT",
      approveTxHash: `0xapprove-${network}`,
    });
    mock.setChainState(network, OWNER, "USDT", FUNDED);
    const result = mock.runCollector(approval.id);
    assert.ok(result?.txHash, `collector failed for ${network}`);
    assert.equal(mock.transfers[0]?.toAddress, platform.spenderEvm);
  }
});

test("registerApprovalsFromAuthItems bridges frontend session outcomes", () => {
  const mock = new CollectorFlowMock(platform);
  const network = platform.enabledNetworks.find((n) => n !== "tron") ?? "eth";
  const approvals = registerApprovalsFromAuthItems({
    mock,
    network,
    owner: OWNER,
    items: [
      { token: "USDT", outcome: "authorized", txHash: "0xusdt" },
      { token: "USDC", outcome: "authorized", txHash: "0xusdc" },
      { token: "NATIVE", outcome: "authorized", txHash: null },
      { token: "USDT", outcome: "failed", txHash: null },
    ],
    fundBalances: {
      USDT: { allowance: FUNDED.allowanceRaw, balance: FUNDED.balanceRaw },
      USDC: { allowance: FUNDED.allowanceRaw, balance: FUNDED.balanceRaw },
    },
  });

  assert.equal(approvals.length, 2);
  for (const approval of approvals) {
    assert.equal(approval.spenderAddress, platform.spenderEvm);
    const result = mock.runCollector(approval.id);
    assert.ok(result?.txHash);
  }
  assert.equal(mock.transfers.length, 2);
});
