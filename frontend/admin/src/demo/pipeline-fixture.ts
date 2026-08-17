/** Demo user pipeline snapshot for flowchart + balance hover. */

import type { UserPipelineSnapshot } from "@/types/pipeline";
import { flowId } from "./traceability-fixture";

type DemoUser = {
  address: string;
  userId?: string;
  publicId?: string;
  username?: string;
  wallets?: Array<{ address: string; chainType: string }>;
  firstSeen: string;
  lastActivity: string;
  networksUsed: string[];
  approvedChains: string[];
  workflowStage: string;
  healthStatus: string;
  eventCount: number;
};

function demoBalances(
  address: string,
): Record<string, { native: string; usdt: string; usdc: string }> {
  const isTron = address.startsWith("T");
  if (isTron) {
    return {
      tron: { native: "842.15", usdt: "1250.00", usdc: "320.50" },
    };
  }
  return {
    eth: { native: "0.0842", usdt: "2450.75", usdc: "180.00" },
    bsc: { native: "0.215", usdt: "890.20", usdc: "4120.33" },
    pol: { native: "45.80", usdt: "125.00", usdc: "0" },
    avax: { native: "3.42", usdt: "560.10", usdc: "75.25" },
    arbitrum: { native: "0.012", usdt: "340.00", usdc: "210.00" },
  };
}

function stage(
  walletAddress: string,
  journeyId: string,
  key: string,
  label: string,
  status: UserPipelineSnapshot["assets"][0]["stages"][0]["status"],
  metadata: Record<string, unknown> = {},
  at?: string,
) {
  return {
    key,
    label,
    status,
    at,
    metadata,
    logQuery: {
      walletAddress,
      module: "wallet-service",
      traceId: journeyId,
      transactionId: journeyId,
    },
  };
}

function buildRichPipeline(
  user: DemoUser,
  journeyId: string,
): UserPipelineSnapshot {
  const balances = demoBalances(user.address);
  const at = user.lastActivity;
  const addr = user.address;

  const usdtStages = [
    stage(
      addr,
      journeyId,
      "asset_detected",
      "Asset detected",
      "success",
      { network: "eth", symbol: "USDT" },
      user.firstSeen,
    ),
    stage(
      addr,
      journeyId,
      "approval",
      "Token approval",
      "success",
      { status: "ACTIVE", txHash: "0xdemo-usdt-approve" },
      at,
    ),
    stage(
      addr,
      journeyId,
      "collection_queued",
      "Collection queued",
      "success",
      { nextCheckAt: at },
      at,
    ),
    stage(
      addr,
      journeyId,
      "transfer",
      "Collection transfer",
      "success",
      { status: "confirmed", txHash: "0xdemo-usdt-transfer" },
      at,
    ),
    stage(addr, journeyId, "retry_repair", "Retry / repair", "skipped", {
      retryCount: 0,
    }),
    stage(
      addr,
      journeyId,
      "on_chain_verified",
      "On-chain verified",
      "success",
      { blockNumber: 19200441 },
      at,
    ),
    stage(
      addr,
      journeyId,
      "pipeline_complete",
      "Pipeline complete",
      "success",
      { workflowComplete: true },
      at,
    ),
  ];

  const usdcStages = [
    stage(
      addr,
      journeyId,
      "asset_detected",
      "Asset detected",
      "success",
      { network: "bsc", symbol: "USDC" },
      user.firstSeen,
    ),
    stage(
      addr,
      journeyId,
      "approval",
      "Token approval",
      "success",
      { status: "ACTIVE" },
      at,
    ),
    stage(
      addr,
      journeyId,
      "collection_queued",
      "Collection queued",
      "running",
      { nextCheckAt: at },
      at,
    ),
    stage(
      addr,
      journeyId,
      "transfer",
      "Collection transfer",
      "running",
      { status: "pending", txHash: "0xdemo-usdc-pending" },
      at,
    ),
    stage(addr, journeyId, "retry_repair", "Retry / repair", "skipped", {
      retryCount: 0,
    }),
    stage(
      addr,
      journeyId,
      "on_chain_verified",
      "On-chain verified",
      "waiting",
      {},
    ),
    stage(
      addr,
      journeyId,
      "pipeline_complete",
      "Pipeline complete",
      "waiting",
      {},
    ),
  ];

  const nativeStages = [
    stage(
      addr,
      journeyId,
      "asset_detected",
      "Asset detected",
      "success",
      { network: "eth", symbol: "native" },
      user.firstSeen,
    ),
    stage(
      addr,
      journeyId,
      "transfer_initiated",
      "Transfer initiated",
      "success",
      { txHash: "0xdemo-native-init" },
      at,
    ),
    stage(
      addr,
      journeyId,
      "pending_confirmation",
      "Pending confirmation",
      "running",
      { reconcileAttempts: 3 },
      at,
    ),
    stage(
      addr,
      journeyId,
      "on_chain_verified",
      "On-chain verified",
      "waiting",
      {},
    ),
    stage(
      addr,
      journeyId,
      "pipeline_complete",
      "Pipeline complete",
      "waiting",
      {},
    ),
  ];

  return {
    address: user.address,
    username: user.username ?? null,
    publicId: user.publicId ?? null,
    generatedAt: new Date().toISOString(),
    summary: {
      workflowStage: "collecting",
      healthStatus: "healthy",
      firstSeen: user.firstSeen,
      lastActivity: user.lastActivity,
      networksUsed:
        user.networksUsed.length > 0
          ? user.networksUsed
          : ["eth", "bsc", "pol"],
      approvedChains:
        user.approvedChains.length > 0 ? user.approvedChains : ["eth", "bsc"],
      isComplete: false,
    },
    walletLinked: {
      status: user.eventCount > 0 ? "success" : "waiting",
      at: user.firstSeen,
      metadata: {
        eventCount: user.eventCount,
        networksUsed: user.networksUsed,
        evmAddress: user.address.startsWith("T") ? null : user.address,
        tronAddress: user.address.startsWith("T") ? user.address : null,
        balanceNetworks: Object.keys(balances),
        balances,
      },
      logQuery: {
        walletAddress: user.address,
        action: "connect",
        traceId: journeyId,
        transactionId: journeyId,
      },
    },
    networkApproved: {
      networks: (user.approvedChains.length > 0
        ? user.approvedChains
        : ["eth", "bsc"]
      ).map((network, i) => ({
        network,
        status: i === 0 ? "success" : "success",
        approvalStatus: "ACTIVE",
        metadata: {
          approvalCount: 1 + (i % 2),
          failureCount: 0,
          collectionEnabled: true,
        },
        logQuery: {
          walletAddress: user.address,
          action: "confirm",
          search: network,
          traceId: journeyId,
          transactionId: journeyId,
        },
      })),
    },
    assets: [
      {
        key: "eth:USDT",
        kind: "token",
        network: "eth",
        symbol: "USDT",
        currentStage: "pipeline_complete",
        stages: usdtStages,
        attempts: [
          {
            id: "demo-tr-usdt-1",
            attemptNumber: 1,
            status: "success",
            at,
            txHash: "0xdemo-usdt-transfer",
            metadata: { blockNumber: 19200441 },
          },
        ],
      },
      {
        key: "bsc:USDC",
        kind: "token",
        network: "bsc",
        symbol: "USDC",
        currentStage: "transfer",
        stages: usdcStages,
        attempts: [
          {
            id: "demo-tr-usdc-1",
            attemptNumber: 1,
            status: "running",
            at,
            txHash: "0xdemo-usdc-pending",
            metadata: {},
          },
        ],
      },
      {
        key: "eth:native",
        kind: "native",
        network: "eth",
        symbol: "ETH",
        currentStage: "pending_confirmation",
        stages: nativeStages,
        attempts: [
          {
            id: "demo-nt-eth-1",
            attemptNumber: 1,
            status: "running",
            at,
            txHash: "0xdemo-native-init",
            error: null,
            metadata: { reconcileAttempts: 3 },
          },
        ],
      },
    ],
    metrics: {
      requested: 3,
      approved: 2,
      transfersSuccessful: 1,
      transfersAwaiting: 1,
      transfersFailed: 0,
      retries: 0,
      repaired: 0,
      pendingConfirmations: 1,
      onChainVerified: 1,
      pipelinesCompleted: 1,
      averageProcessingMs: 84200,
      successRate: 67,
      perAsset: {
        "eth:USDT": { requested: 1, successful: 1, failed: 0, awaiting: 0 },
        "bsc:USDC": { requested: 1, successful: 0, failed: 0, awaiting: 1 },
        "eth:native": { requested: 1, successful: 0, failed: 0, awaiting: 1 },
      },
    },
  };
}

function buildSimplePipeline(
  user: DemoUser,
  journeyId: string,
): UserPipelineSnapshot {
  const balances = demoBalances(user.address);
  const hasAssets = user.approvedChains.length > 0;
  const addr = user.address;

  return {
    address: user.address,
    username: user.username ?? null,
    publicId: user.publicId ?? null,
    generatedAt: new Date().toISOString(),
    summary: {
      workflowStage:
        user.workflowStage as UserPipelineSnapshot["summary"]["workflowStage"],
      healthStatus:
        user.healthStatus as UserPipelineSnapshot["summary"]["healthStatus"],
      firstSeen: user.firstSeen,
      lastActivity: user.lastActivity,
      networksUsed: user.networksUsed,
      approvedChains: user.approvedChains,
      isComplete: user.workflowStage === "completed",
    },
    walletLinked: {
      status: user.eventCount > 0 ? "success" : "waiting",
      at: user.firstSeen,
      metadata: {
        eventCount: user.eventCount,
        networksUsed: user.networksUsed,
        evmAddress: user.address.startsWith("T") ? null : user.address,
        tronAddress: user.address.startsWith("T") ? user.address : null,
        balanceNetworks: Object.keys(balances),
        balances,
      },
      logQuery: {
        walletAddress: user.address,
        action: "connect",
        traceId: journeyId,
        transactionId: journeyId,
      },
    },
    networkApproved: {
      networks: user.approvedChains.slice(0, 2).map((network) => ({
        network,
        status: "success" as const,
        approvalStatus: "ACTIVE",
        metadata: { approvalCount: 1 },
        logQuery: {
          walletAddress: user.address,
          action: "confirm",
          traceId: journeyId,
          transactionId: journeyId,
        },
      })),
    },
    assets: hasAssets
      ? [
          {
            key: `${user.approvedChains[0] ?? "eth"}:USDT`,
            kind: "token" as const,
            network: user.approvedChains[0] ?? "eth",
            symbol: "USDT",
            currentStage:
              user.workflowStage === "completed"
                ? "pipeline_complete"
                : "approval",
            stages: [
              stage(
                addr,
                journeyId,
                "asset_detected",
                "Asset detected",
                "success",
                {},
                user.firstSeen,
              ),
              stage(
                addr,
                journeyId,
                "approval",
                "Token approval",
                user.workflowStage === "failed" ? "failed" : "success",
                {},
                user.lastActivity,
              ),
              stage(
                addr,
                journeyId,
                "collection_queued",
                "Collection queued",
                "waiting",
                {},
              ),
              stage(
                addr,
                journeyId,
                "transfer",
                "Collection transfer",
                "waiting",
                {},
              ),
              stage(
                addr,
                journeyId,
                "retry_repair",
                "Retry / repair",
                "skipped",
                {},
              ),
              stage(
                addr,
                journeyId,
                "on_chain_verified",
                "On-chain verified",
                "waiting",
                {},
              ),
              stage(
                addr,
                journeyId,
                "pipeline_complete",
                "Pipeline complete",
                user.workflowStage === "completed" ? "success" : "waiting",
                {},
              ),
            ],
            attempts: [],
          },
        ]
      : [],
    metrics: {
      requested: hasAssets ? 1 : 0,
      approved: hasAssets ? 1 : 0,
      transfersSuccessful: user.workflowStage === "completed" ? 1 : 0,
      transfersAwaiting: user.workflowStage === "collecting" ? 1 : 0,
      transfersFailed: user.workflowStage === "failed" ? 1 : 0,
      retries: 0,
      repaired: 0,
      pendingConfirmations: 0,
      onChainVerified: user.workflowStage === "completed" ? 1 : 0,
      pipelinesCompleted: user.workflowStage === "completed" ? 1 : 0,
      averageProcessingMs: 120000,
      successRate: user.workflowStage === "completed" ? 100 : 50,
      perAsset: {},
    },
  };
}

export function buildDemoPipelineSnapshot(
  identifier: string,
  users: DemoUser[],
): UserPipelineSnapshot {
  const user =
    users.find(
      (u) =>
        u.address === identifier ||
        u.publicId === identifier ||
        u.userId === identifier ||
        u.username === identifier,
    ) ?? users[0];
  if (!user) {
    throw new Error("Demo pipeline requires at least one user");
  }
  const journeyId = flowId(1, user.address);
  const isPrimary =
    user.address === users[0]?.address ||
    user.workflowStage === "collecting" ||
    user.workflowStage === "completed";
  return isPrimary
    ? buildRichPipeline(user, journeyId)
    : buildSimplePipeline(user, journeyId);
}

export { demoBalances };
