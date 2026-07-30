import { Injectable } from "@nestjs/common";
import type { ApprovalStatus, TransferStatus } from "@prisma/client";
import {
  isTransferConfirmed,
  isTransferPendingConfirmation,
  transferErrorMessage,
  nativeErrorMessage,
  isNativeConfirmed,
  isNativePending,
} from "../user-pipeline-workflow";
import { UserAggregationService } from "../user-aggregation.service";
import type {
  AssetPipeline,
  LogLinkParams,
  NetworkApprovedEntry,
  PipelineAttempt,
  PipelineHealthStatus,
  PipelineMetrics,
  PipelineStage,
  PipelineStageStatus,
  PipelineUserSummary,
  PipelineWorkflowStage,
  UserPipelineSnapshot,
  WalletLinkedStage,
} from "./pipeline-model";

type DetectedAsset = {
  key: string;
  kind: "token" | "native";
  network: string;
  symbol: string;
};

type ApprovalRow = {
  id: string;
  network: string;
  tokenSymbol: string;
  status: ApprovalStatus;
  txHash: string;
  collectionEnabled: boolean;
  nextCheckAt: Date | null;
  failureCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransferRow = {
  id: string;
  approvalId: string;
  status: TransferStatus;
  txHash: string | null;
  blockNumber: number | null;
  errorMessage: string | null;
  retryCount: number;
  broadcastAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approval: { network: string; tokenSymbol: string };
};

type NativeRow = {
  id: string;
  network: string;
  assetSymbol: string;
  status: TransferStatus;
  txHash: string;
  blockNumber: number | null;
  errorMessage: string | null;
  reconcileAttempts: number;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ObservabilityRow = {
  id: string;
  kind: string;
  ts: Date | string;
  network: string | null;
  stage: string | null;
  status: string;
  message: string;
  errorMessage: string | null;
  sessionId: string | null;
};

const AUTH_STAGES = ["PREPARE", "SIGN", "BROADCAST", "CONFIRM"] as const;

function stage(
  key: string,
  label: string,
  status: PipelineStageStatus,
  logQuery: LogLinkParams,
  metadata: Record<string, unknown> = {},
  at?: Date | null
): PipelineStage {
  return {
    key,
    label,
    status,
    at: at?.toISOString(),
    metadata,
    logQuery,
  };
}

function transferStageStatus(t: TransferRow): PipelineStageStatus {
  if (isTransferConfirmed(t)) return "success";
  if (t.status === "failed") return "failed";
  if (t.retryCount > 0) return "retried";
  if (isTransferPendingConfirmation(t)) return "running";
  return "waiting";
}

function attemptFromTransfer(t: TransferRow, attemptNumber: number): PipelineAttempt {
  return {
    id: t.id,
    attemptNumber,
    status: transferStageStatus(t),
    at: (t.broadcastAt ?? t.updatedAt ?? t.createdAt).toISOString(),
    txHash: t.txHash,
    error: transferErrorMessage(t),
    metadata: {
      status: t.status,
      blockNumber: t.blockNumber,
      retryCount: t.retryCount,
      confirmedAt: t.confirmedAt?.toISOString() ?? null,
    },
  };
}

function isOnChainVerifiedTransfer(t: TransferRow): boolean {
  return isTransferConfirmed(t) && t.blockNumber != null && t.confirmedAt != null;
}

function isOnChainVerifiedNative(n: NativeRow): boolean {
  return isNativeConfirmed(n) && n.blockNumber != null && n.confirmedAt != null;
}

function approvalStageStatus(status: ApprovalStatus): PipelineStageStatus {
  if (status === "ACTIVE" || status === "PARTIALLY_USED" || status === "COMPLETED") {
    return "success";
  }
  if (status === "FAILED") return "failed";
  if (status === "SUBMITTED") return "running";
  if (status === "REVOKED" || status === "EXPIRED" || status === "SUPERSEDED") {
    return "skipped";
  }
  return "waiting";
}

@Injectable()
export class PipelineBuilderService {
  constructor(private readonly userAggregation: UserAggregationService) {}

  async buildPipeline(address: string): Promise<UserPipelineSnapshot> {
    const detail = await this.userAggregation.getUserDetail(address);
    const walletAddress = detail.address;

    let balances: Awaited<ReturnType<UserAggregationService["getUserBalances"]>> = {};
    try {
      balances = await this.userAggregation.getUserBalances(walletAddress);
    } catch {
      balances = {};
    }

    const approvals = detail.approvalHistory as ApprovalRow[];
    const transfers = detail.transfers as unknown as TransferRow[];
    const nativeTransfers = detail.nativeTransfers as NativeRow[];
    const events = detail.events as Array<{ createdAt: string | Date }>;
    const observabilityEvents = (detail.observabilityEvents ?? []) as ObservabilityRow[];

    const assets = this.detectAssets(balances, approvals, transfers, nativeTransfers);
    const assetPipelines = assets.map((asset) =>
      asset.kind === "token"
        ? this.buildTokenPipeline(
            asset,
            walletAddress,
            approvals,
            transfers,
            observabilityEvents
          )
        : this.buildNativePipeline(
            asset,
            walletAddress,
            nativeTransfers,
            observabilityEvents
          )
    );

    const metrics = this.computeMetrics(
      assets,
      assetPipelines,
      approvals,
      transfers,
      nativeTransfers
    );

    const firstEventAt = events.length
      ? new Date(
          Math.min(...events.map((e) => new Date(e.createdAt).getTime()))
        )
      : null;

    const firstObsAt = observabilityEvents.length
      ? new Date(
          Math.min(
            ...observabilityEvents.map((e) => new Date(e.ts).getTime())
          )
        )
      : null;

    const walletLinked: WalletLinkedStage = {
      status:
        detail.summary.eventCount > 0 || observabilityEvents.length > 0
          ? "success"
          : "waiting",
      at: (firstEventAt ?? firstObsAt)?.toISOString(),
      metadata: {
        eventCount: detail.summary.eventCount,
        observabilityCount: observabilityEvents.length,
        networksUsed: detail.summary.networksUsed,
        evmAddress: detail.balancesHint.evmAddress,
        tronAddress: detail.balancesHint.tronAddress,
        balanceNetworks: Object.keys(balances),
        balances,
      },
      logQuery: {
        walletAddress,
        tab: "connections",
      },
    };

    const networkApproved: { networks: NetworkApprovedEntry[] } = {
      networks: this.buildNetworkApproved(walletAddress, approvals),
    };

    const userSummary = detail.summary as {
      workflowStage: PipelineWorkflowStage;
      healthStatus: PipelineHealthStatus;
      firstSeen: Date | string | null;
      lastActivity: Date | string | null;
      networksUsed: string[];
      approvedChains: string[];
    };

    const isComplete =
      assetPipelines.length > 0 &&
      assetPipelines.every((asset) =>
        asset.stages.some(
          (st) => st.key === "pipeline_complete" && st.status === "success"
        )
      );

    const summary: PipelineUserSummary = {
      workflowStage: userSummary.workflowStage,
      healthStatus: userSummary.healthStatus,
      firstSeen: userSummary.firstSeen
        ? new Date(userSummary.firstSeen).toISOString()
        : null,
      lastActivity: userSummary.lastActivity
        ? new Date(userSummary.lastActivity).toISOString()
        : null,
      networksUsed: userSummary.networksUsed ?? [],
      approvedChains: userSummary.approvedChains ?? [],
      isComplete,
    };

    return {
      address: walletAddress,
      generatedAt: new Date().toISOString(),
      summary,
      walletLinked,
      networkApproved,
      assets: assetPipelines,
      metrics,
    };
  }

  private detectAssets(
    balances: Awaited<ReturnType<UserAggregationService["getUserBalances"]>>,
    approvals: ApprovalRow[],
    transfers: TransferRow[],
    nativeTransfers: NativeRow[]
  ): DetectedAsset[] {
    const map = new Map<string, DetectedAsset>();

    const add = (network: string, symbol: string, kind: "token" | "native") => {
      const key = `${network}:${kind === "native" ? "native" : symbol}`;
      if (!map.has(key)) {
        map.set(key, { key, kind, network, symbol });
      }
    };

    for (const [network, b] of Object.entries(balances)) {
      if (parseFloat(b.native) > 0) add(network, "native", "native");
      if (parseFloat(b.usdt ?? "0") > 0) add(network, "USDT", "token");
      if (parseFloat(b.usdc ?? "0") > 0) add(network, "USDC", "token");
    }

    for (const a of approvals) {
      add(a.network, a.tokenSymbol, "token");
    }

    for (const t of transfers) {
      if (t.approval.network && t.approval.tokenSymbol) {
        add(t.approval.network, t.approval.tokenSymbol, "token");
      }
    }

    for (const n of nativeTransfers) {
      add(n.network, n.assetSymbol || "native", "native");
    }

    return [...map.values()].sort((a, b) =>
      `${a.network}:${a.symbol}`.localeCompare(`${b.network}:${b.symbol}`)
    );
  }

  private buildNetworkApproved(
    walletAddress: string,
    approvals: ApprovalRow[]
  ): NetworkApprovedEntry[] {
    const byNetwork = new Map<string, ApprovalRow[]>();
    for (const a of approvals) {
      const list = byNetwork.get(a.network) ?? [];
      list.push(a);
      byNetwork.set(a.network, list);
    }

    return [...byNetwork.entries()].map(([network, rows]) => {
      const latest = rows.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )[0]!;
      return {
        network,
        status: approvalStageStatus(latest.status),
        approvalStatus: latest.status,
        metadata: {
          approvalCount: rows.length,
          failureCount: latest.failureCount,
          lastError: latest.lastError,
          collectionEnabled: latest.collectionEnabled,
        },
        logQuery: {
          walletAddress,
          tab: "all",
          search: network,
        },
      };
    });
  }

  private buildTokenPipeline(
    asset: DetectedAsset,
    walletAddress: string,
    approvals: ApprovalRow[],
    transfers: TransferRow[],
    observabilityEvents: ObservabilityRow[] = []
  ): AssetPipeline {
    const assetApprovals = approvals
      .filter(
        (a) => a.network === asset.network && a.tokenSymbol === asset.symbol
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const assetTransfers = transfers
      .filter(
        (t) =>
          t.approval.network === asset.network &&
          t.approval.tokenSymbol === asset.symbol
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const latestApproval = assetApprovals[assetApprovals.length - 1] ?? null;
    const latestTransfer = assetTransfers[assetTransfers.length - 1] ?? null;
    const verified = assetTransfers.some(isOnChainVerifiedTransfer);

    const attempts = assetTransfers.map((t, i) => attemptFromTransfer(t, i + 1));

    const logBase: LogLinkParams = { walletAddress, search: asset.network };

    const stages: PipelineStage[] = [
      stage(
        "asset_detected",
        "Asset detected",
        assetApprovals.length > 0 || assetTransfers.length > 0 ? "success" : "waiting",
        logBase,
        { network: asset.network, symbol: asset.symbol },
        assetApprovals[0]?.createdAt ?? assetTransfers[0]?.createdAt
      ),
    ];

    const networkObs = observabilityEvents.filter(
      (e) =>
        e.network?.toLowerCase() === asset.network.toLowerCase() &&
        (e.kind === "timeline_node" || e.kind === "log")
    );
    for (const authStage of AUTH_STAGES) {
      const hits = networkObs.filter(
        (e) => e.stage?.toUpperCase() === authStage
      );
      if (hits.length === 0) continue;
      const latest = hits.sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
      )[0];
      const stageStatus: PipelineStageStatus =
        latest.status === "error" || latest.status === "failed"
          ? "failed"
          : latest.status === "success"
            ? "success"
            : "running";
      stages.push(
        stage(
          `auth_${authStage.toLowerCase()}`,
          `Authorization · ${authStage}`,
          stageStatus,
          { ...logBase, type: authStage, tab: "flow" },
          {
            message: latest.message,
            error: latest.errorMessage,
            sessionId: latest.sessionId,
          },
          new Date(latest.ts)
        )
      );
    }

    const approvalStatus = latestApproval
      ? approvalStageStatus(latestApproval.status)
      : "waiting";
    stages.push(
      stage(
        "approval",
        "Token approval",
        approvalStatus,
        { ...logBase, action: "confirm" },
        {
          status: latestApproval?.status,
          txHash: latestApproval?.txHash,
          failureCount: latestApproval?.failureCount,
        },
        latestApproval?.updatedAt
      )
    );

    const collectionQueued =
      latestApproval?.collectionEnabled &&
      ["ACTIVE", "PARTIALLY_USED"].includes(latestApproval.status);
    stages.push(
      stage(
        "collection_queued",
        "Collection queued",
        collectionQueued ? "running" : latestApproval ? "skipped" : "waiting",
        { ...logBase, module: "collector" },
        { nextCheckAt: latestApproval?.nextCheckAt?.toISOString() ?? null },
        latestApproval?.nextCheckAt
      )
    );

    let transferStatus: PipelineStageStatus = "waiting";
    if (latestTransfer) {
      transferStatus = transferStageStatus(latestTransfer);
      if (verified && transferStatus === "failed") transferStatus = "success";
    }
    stages.push(
      stage(
        "transfer",
        "Collection transfer",
        transferStatus,
        {
          ...logBase,
          txHash: latestTransfer?.txHash ?? undefined,
          module: "wallet-service",
        },
        {
          status: latestTransfer?.status,
          txHash: latestTransfer?.txHash,
          blockNumber: latestTransfer?.blockNumber,
        },
        latestTransfer?.broadcastAt ?? latestTransfer?.updatedAt
      )
    );

    const hasRetries = assetTransfers.some((t) => t.retryCount > 0);
    stages.push(
      stage(
        "retry_repair",
        "Retry / repair",
        hasRetries ? "retried" : latestTransfer ? "skipped" : "waiting",
        { ...logBase, action: "transfer.reconcile" },
        { retryCount: latestTransfer?.retryCount ?? 0 },
        latestTransfer?.updatedAt
      )
    );

    stages.push(
      stage(
        "on_chain_verified",
        "On-chain verified",
        verified ? "success" : latestTransfer ? "running" : "waiting",
        { ...logBase, txHash: latestTransfer?.txHash ?? undefined },
        {
          blockNumber: latestTransfer?.blockNumber,
          confirmedAt: latestTransfer?.confirmedAt?.toISOString(),
        },
        latestTransfer?.confirmedAt
      )
    );

    const complete =
      verified ||
      (latestApproval &&
        ["COMPLETED", "REVOKED"].includes(latestApproval.status) &&
        isTransferConfirmed(latestTransfer));
    stages.push(
      stage(
        "pipeline_complete",
        "Pipeline complete",
        complete ? "success" : "waiting",
        logBase,
        { workflowComplete: complete },
        latestTransfer?.confirmedAt ?? latestApproval?.updatedAt
      )
    );

    const currentStage =
      [...stages].reverse().find((s) => s.status !== "skipped" && s.status !== "waiting")
        ?.key ?? "asset_detected";

    return {
      key: asset.key,
      kind: "token",
      network: asset.network,
      symbol: asset.symbol,
      currentStage,
      stages,
      attempts,
    };
  }

  private buildNativePipeline(
    asset: DetectedAsset,
    walletAddress: string,
    nativeTransfers: NativeRow[],
    observabilityEvents: ObservabilityRow[] = []
  ): AssetPipeline {
    const rows = nativeTransfers
      .filter(
        (n) =>
          n.network === asset.network &&
          (n.assetSymbol === asset.symbol ||
            (asset.symbol === "native" && !n.assetSymbol))
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const latest = rows[rows.length - 1] ?? null;
    const verified = rows.some(isOnChainVerifiedNative);
    const logBase: LogLinkParams = { walletAddress, search: asset.network };

    const attempts: PipelineAttempt[] = rows.map((n, i) => ({
      id: n.id,
      attemptNumber: i + 1,
      status: isNativeConfirmed(n)
        ? "success"
        : n.status === "failed"
          ? "failed"
          : isNativePending(n)
            ? "running"
            : "waiting",
      at: n.updatedAt.toISOString(),
      txHash: n.txHash,
      error: nativeErrorMessage(n),
      metadata: {
        status: n.status,
        reconcileAttempts: n.reconcileAttempts,
        blockNumber: n.blockNumber,
      },
    }));

    let transferStatus: PipelineStageStatus = "waiting";
    if (latest) {
      if (isNativeConfirmed(latest)) transferStatus = "success";
      else if (latest.status === "failed") transferStatus = verified ? "success" : "failed";
      else if (isNativePending(latest)) transferStatus = "running";
    }

    const stages: PipelineStage[] = [
      stage(
        "asset_detected",
        "Asset detected",
        rows.length > 0 ? "success" : "waiting",
        logBase,
        { network: asset.network, symbol: asset.symbol },
        rows[0]?.createdAt
      ),
      stage(
        "transfer_initiated",
        "Transfer initiated",
        latest ? (latest.txHash ? "success" : "running") : "waiting",
        { ...logBase, txHash: latest?.txHash },
        { txHash: latest?.txHash },
        latest?.createdAt
      ),
      stage(
        "pending_confirmation",
        "Pending confirmation",
        latest && isNativePending(latest) ? "running" : latest ? "success" : "waiting",
        { ...logBase, action: "transfer.reconcile" },
        { reconcileAttempts: latest?.reconcileAttempts ?? 0 },
        latest?.updatedAt
      ),
      stage(
        "on_chain_verified",
        "On-chain verified",
        verified ? "success" : latest ? "running" : "waiting",
        { ...logBase, txHash: latest?.txHash },
        {
          blockNumber: latest?.blockNumber,
          confirmedAt: latest?.confirmedAt?.toISOString(),
        },
        latest?.confirmedAt
      ),
      stage(
        "pipeline_complete",
        "Pipeline complete",
        verified ? "success" : "waiting",
        logBase,
        {},
        latest?.confirmedAt
      ),
    ];

    if (verified && transferStatus === "failed") transferStatus = "success";

    const currentStage =
      [...stages].reverse().find((s) => s.status === "running" || s.status === "failed")
        ?.key ??
      (verified ? "pipeline_complete" : stages[stages.length - 1]?.key ?? "asset_detected");

    return {
      key: asset.key,
      kind: "native",
      network: asset.network,
      symbol: asset.symbol,
      currentStage,
      stages,
      attempts,
    };
  }

  private computeMetrics(
    assets: DetectedAsset[],
    pipelines: AssetPipeline[],
    approvals: ApprovalRow[],
    transfers: TransferRow[],
    nativeTransfers: NativeRow[]
  ): PipelineMetrics {
    const confirmedTransfers = transfers.filter(isTransferConfirmed);
    const failedTransfers = transfers.filter((t) => t.status === "failed" && !isOnChainVerifiedTransfer(t));
    const awaitingTransfers = transfers.filter(isTransferPendingConfirmation);
    const verifiedTransfers = transfers.filter(isOnChainVerifiedTransfer);
    const verifiedNative = nativeTransfers.filter(isOnChainVerifiedNative);
    const retries = transfers.reduce((sum, t) => sum + t.retryCount, 0) +
      nativeTransfers.reduce((sum, n) => sum + n.reconcileAttempts, 0);

    const processingTimes: number[] = [];
    for (const t of transfers) {
      if (t.broadcastAt && t.confirmedAt) {
        processingTimes.push(
          t.confirmedAt.getTime() - t.broadcastAt.getTime()
        );
      }
    }

    const completedPipelines = pipelines.filter((p) =>
      p.stages.some((s) => s.key === "pipeline_complete" && s.status === "success")
    ).length;
    const terminalFailures = pipelines.filter((p) =>
      p.stages.some((s) => s.status === "failed")
    ).length;
    const successRate =
      completedPipelines + terminalFailures > 0
        ? (completedPipelines / (completedPipelines + terminalFailures)) * 100
        : 100;

    const perAsset: PipelineMetrics["perAsset"] = {};
    for (const asset of assets) {
      if (asset.kind === "token") {
        const assetTransfers = transfers.filter(
          (t) =>
            t.approval.network === asset.network &&
            t.approval.tokenSymbol === asset.symbol
        );
        perAsset[asset.key] = {
          requested: approvals.filter(
            (a) => a.network === asset.network && a.tokenSymbol === asset.symbol
          ).length,
          successful: assetTransfers.filter(isTransferConfirmed).length,
          failed: assetTransfers.filter((t) => t.status === "failed").length,
          awaiting: assetTransfers.filter(isTransferPendingConfirmation).length,
        };
      } else {
        const rows = nativeTransfers.filter((n) => n.network === asset.network);
        perAsset[asset.key] = {
          requested: rows.length,
          successful: rows.filter(isNativeConfirmed).length,
          failed: rows.filter((n) => n.status === "failed").length,
          awaiting: rows.filter(isNativePending).length,
        };
      }
    }

    return {
      requested: assets.length,
      approved: approvals.filter((a) =>
        ["ACTIVE", "PARTIALLY_USED", "COMPLETED"].includes(a.status)
      ).length,
      transfersSuccessful: confirmedTransfers.length + verifiedNative.length,
      transfersAwaiting: awaitingTransfers.length + nativeTransfers.filter(isNativePending).length,
      transfersFailed: failedTransfers.length,
      retries,
      repaired: retries,
      pendingConfirmations: awaitingTransfers.length,
      onChainVerified: verifiedTransfers.length + verifiedNative.length,
      pipelinesCompleted: completedPipelines,
      averageProcessingMs:
        processingTimes.length > 0
          ? Math.round(
              processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
            )
          : null,
      successRate,
      perAsset,
    };
  }
}
