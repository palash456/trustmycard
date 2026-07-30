import assert from "node:assert/strict";
import test from "node:test";
import { PipelineBuilderService } from "../src/modules/admin/pipeline/pipeline-builder.service";
import type { UserAggregationService } from "../src/modules/admin/user-aggregation.service";

function mockAggregation(detail: Record<string, unknown>, balances = {}) {
  return {
    getUserDetail: async () => detail,
    getUserBalances: async () => balances,
  } as unknown as UserAggregationService;
}

test("pipeline builder keeps chronological attempt history for same approval", async () => {
  const approval = {
    id: "ap1",
    network: "avax",
    tokenSymbol: "USDT",
    status: "ACTIVE",
    txHash: "0xapprove",
    collectionEnabled: true,
    nextCheckAt: null,
    failureCount: 0,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
  const transfers = [
    {
      id: "t1",
      approvalId: "ap1",
      status: "failed",
      txHash: "0xfirst",
      blockNumber: null,
      errorMessage: "reverted",
      retryCount: 1,
      broadcastAt: new Date("2026-01-03T00:00:00Z"),
      confirmedAt: null,
      createdAt: new Date("2026-01-03T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
      approval: { network: "avax", tokenSymbol: "USDT" },
    },
    {
      id: "t2",
      approvalId: "ap1",
      status: "confirmed",
      txHash: "0xsecond",
      blockNumber: 123,
      errorMessage: null,
      retryCount: 0,
      broadcastAt: new Date("2026-01-04T00:00:00Z"),
      confirmedAt: new Date("2026-01-04T00:01:00Z"),
      createdAt: new Date("2026-01-04T00:00:00Z"),
      updatedAt: new Date("2026-01-04T00:01:00Z"),
      approval: { network: "avax", tokenSymbol: "USDT" },
    },
  ];

  const detail = {
    address: "0xabc",
    summary: {
      eventCount: 1,
      networksUsed: ["avax"],
      workflowStage: "completed",
      healthStatus: "healthy",
    },
    balancesHint: { evmAddress: "0xabc", tronAddress: null },
    approvalHistory: [approval],
    transfers,
    nativeTransfers: [],
    events: [{ createdAt: new Date("2026-01-01T00:00:00Z") }],
  };

  const builder = new PipelineBuilderService(mockAggregation(detail));
  const snapshot = await builder.buildPipeline("0xabc");
  const asset = snapshot.assets.find((a) => a.key === "avax:USDT");
  assert.ok(asset);
  assert.equal(asset.attempts.length, 2);
  assert.equal(asset.attempts[0]!.id, "t1");
  assert.equal(asset.attempts[1]!.id, "t2");
  assert.equal(asset.attempts[0]!.attemptNumber, 1);
  assert.equal(asset.attempts[1]!.attemptNumber, 2);
  assert.equal(snapshot.summary.workflowStage, "completed");
  assert.equal(snapshot.summary.healthStatus, "healthy");
  assert.equal(snapshot.summary.isComplete, true);
});

test("on-chain verified transfer never marks collection stage failed", async () => {
  const approval = {
    id: "ap1",
    network: "avax",
    tokenSymbol: "USDT",
    status: "REVOKED",
    txHash: "0xapprove",
    collectionEnabled: false,
    nextCheckAt: null,
    failureCount: 0,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-05T00:00:00Z"),
  };
  const transfers = [
    {
      id: "t1",
      approvalId: "ap1",
      status: "confirmed",
      txHash: "0xconfirmed",
      blockNumber: 91534790,
      errorMessage: "stale audit error",
      retryCount: 0,
      broadcastAt: new Date("2026-01-04T00:00:00Z"),
      confirmedAt: new Date("2026-01-04T00:01:00Z"),
      createdAt: new Date("2026-01-04T00:00:00Z"),
      updatedAt: new Date("2026-01-04T00:01:00Z"),
      approval: { network: "avax", tokenSymbol: "USDT" },
    },
  ];

  const detail = {
    address: "0xabc",
    summary: {
      eventCount: 1,
      networksUsed: ["avax"],
      workflowStage: "completed",
      healthStatus: "healthy",
    },
    balancesHint: { evmAddress: "0xabc", tronAddress: null },
    approvalHistory: [approval],
    transfers,
    nativeTransfers: [],
    events: [{ createdAt: new Date("2026-01-01T00:00:00Z") }],
  };

  const builder = new PipelineBuilderService(mockAggregation(detail));
  const snapshot = await builder.buildPipeline("0xabc");
  const asset = snapshot.assets.find((a) => a.key === "avax:USDT");
  assert.ok(asset);
  const transferStage = asset.stages.find((s) => s.key === "transfer");
  assert.equal(transferStage?.status, "success");
  const verifiedStage = asset.stages.find((s) => s.key === "on_chain_verified");
  assert.equal(verifiedStage?.status, "success");
  const completeStage = asset.stages.find((s) => s.key === "pipeline_complete");
  assert.equal(completeStage?.status, "success");
  assert.equal(snapshot.summary.workflowStage, "completed");
  assert.equal(snapshot.summary.isComplete, true);
});

test("pipeline builder only includes detected assets with activity", async () => {
  const detail = {
    address: "0xabc",
    summary: {
      eventCount: 1,
      networksUsed: ["avax"],
      workflowStage: "approved",
      healthStatus: "healthy",
    },
    balancesHint: { evmAddress: "0xabc", tronAddress: null },
    approvalHistory: [
      {
        id: "ap1",
        network: "avax",
        tokenSymbol: "USDT",
        status: "ACTIVE",
        txHash: "0xapprove",
        collectionEnabled: true,
        nextCheckAt: null,
        failureCount: 0,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    transfers: [],
    nativeTransfers: [],
    events: [{ createdAt: new Date() }],
  };

  const builder = new PipelineBuilderService(
    mockAggregation(detail, { avax: { native: "0", usdt: "0", usdc: "0" } })
  );
  const snapshot = await builder.buildPipeline("0xabc");
  assert.equal(snapshot.assets.length, 1);
  assert.equal(snapshot.assets[0]!.symbol, "USDT");
  assert.equal(snapshot.assets.some((a) => a.symbol === "USDC"), false);
  assert.equal(snapshot.summary.workflowStage, "approved");
  assert.equal(snapshot.summary.isComplete, false);
});

test("pipeline builder includes full chain balances on wallet linked stage", async () => {
  const detail = {
    address: "0xabc",
    summary: {
      eventCount: 2,
      networksUsed: ["eth", "tron"],
      workflowStage: "connected",
      healthStatus: "healthy",
      firstSeen: new Date("2026-01-01T00:00:00Z"),
      lastActivity: new Date("2026-01-02T00:00:00Z"),
      approvedChains: [],
    },
    balancesHint: { evmAddress: "0xabc", tronAddress: null },
    approvalHistory: [],
    transfers: [],
    nativeTransfers: [],
    events: [{ createdAt: new Date("2026-01-01T00:00:00Z") }],
  };

  const balances = {
    eth: { native: "1.25", usdt: "100.5", usdc: "0" },
    tron: { native: "42", usdt: "250", usdc: "10" },
  };

  const builder = new PipelineBuilderService(mockAggregation(detail, balances));
  const snapshot = await builder.buildPipeline("0xabc");

  assert.deepEqual(snapshot.walletLinked.metadata.balanceNetworks, ["eth", "tron"]);
  assert.deepEqual(snapshot.walletLinked.metadata.balances, balances);
});
