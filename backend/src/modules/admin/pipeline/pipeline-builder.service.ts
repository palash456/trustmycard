import { Injectable } from "@nestjs/common";
import type { ApprovalStatus, TransferStatus } from "@prisma/client";
import {
  formatNativeAuthKind,
  NETWORK_SETTLEMENT_STATUS_LABELS,
} from "@trustmycard/shared/constants/settlement";
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
  traceId?: string | null;
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
  traceId?: string | null;
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

type SettlementRow = {
  id: string;
  network: string;
  status: keyof typeof NETWORK_SETTLEMENT_STATUS_LABELS;
  usdtSettled: boolean;
  usdcSettled: boolean;
  nativeReady: boolean;
  nativeAuthKind: string | null;
  lastError: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  clientSessionId: string;
};

const AUTH_STAGES = ["PREPARE", "SIGN", "BROADCAST", "CONFIRM"] as const;

function stage(
  key: string,
  label: string,
  status: PipelineStageStatus,
  logQuery: LogLinkParams,
  metadata: Record<string, unknown> = {},
  at?: Date | null,
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

function attemptFromTransfer(
  t: TransferRow,
  attemptNumber: number,
): PipelineAttempt {
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
  return (
    isTransferConfirmed(t) && t.blockNumber != null && t.confirmedAt != null
  );
}

function isOnChainVerifiedNative(n: NativeRow): boolean {
  return isNativeConfirmed(n) && n.blockNumber != null && n.confirmedAt != null;
}

function approvalStageStatus(status: ApprovalStatus): PipelineStageStatus {
  if (
    status === "ACTIVE" ||
    status === "PARTIALLY_USED" ||
    status === "COMPLETED"
  ) {
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

    let balances: Awaited<
      ReturnType<UserAggregationService["getUserBalances"]>
    > = {};
    try {
      balances = await this.userAggregation.getUserBalances(walletAddress);
    } catch {
      balances = {};
    }

    const approvals = detail.approvalHistory as ApprovalRow[];
    const transfers = detail.transfers as unknown as TransferRow[];
    const nativeTransfers = detail.nativeTransfers as NativeRow[];
    const events = detail.events as Array<{ createdAt: string | Date }>;
    const observabilityEvents = (detail.observabilityEvents ??
      []) as ObservabilityRow[];
    const settlementSessions = (detail.settlementSessions ??
      []) as SettlementRow[];

    const assets = this.detectAssets(
      balances,
      approvals,
      transfers,
      nativeTransfers,
    );
    const assetPipelines = assets.map((asset) =>
      asset.kind === "token"
        ? this.buildTokenPipeline(
            asset,
            walletAddress,
            approvals,
            transfers,
            observabilityEvents,
            settlementSessions,
          )
        : this.buildNativePipeline(
            asset,
            walletAddress,
            nativeTransfers,
            observabilityEvents,
            settlementSessions,
          ),
    );

    const metrics = this.computeMetrics(
      assets,
      assetPipelines,
      approvals,
      transfers,
      nativeTransfers,
    );

    const firstEventAt = events.length
      ? new Date(
          Math.min(...events.map((e) => new Date(e.createdAt).getTime())),
        )
      : null;

    const firstObsAt = observabilityEvents.length
      ? new Date(
          Math.min(...observabilityEvents.map((e) => new Date(e.ts).getTime())),
        )
      : null;

    const latestSettlement = settlementSessions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
    const latestObsSession = observabilityEvents
      .filter((e) => e.sessionId)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];

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
        clientSessionId: latestSettlement?.clientSessionId,
        transactionId:
          latestSettlement?.clientSessionId ??
          latestObsSession?.sessionId ??
          undefined,
      },
      logQuery: {
        walletAddress,
        tab: "connections",
        traceId:
          latestSettlement?.clientSessionId ??
          latestObsSession?.sessionId ??
          undefined,
        transactionId:
          latestSettlement?.clientSessionId ??
          latestObsSession?.sessionId ??
          undefined,
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
          (st) => st.key === "pipeline_complete" && st.status === "success",
        ),
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
      settlementSessions: settlementSessions.map((s) => ({
        id: s.id,
        network: s.network,
        status: s.status,
        statusLabel: NETWORK_SETTLEMENT_STATUS_LABELS[s.status] ?? s.status,
        usdtSettled: s.usdtSettled,
        usdcSettled: s.usdcSettled,
        nativeReady: s.nativeReady,
        nativeAuthKind: s.nativeAuthKind,
        nativeAuthKindLabel: s.nativeAuthKind
          ? formatNativeAuthKind(s.nativeAuthKind)
          : null,
        lastError: s.lastError,
        clientSessionId: s.clientSessionId,
        updatedAt: new Date(s.updatedAt).toISOString(),
        completedAt: s.completedAt
          ? new Date(s.completedAt).toISOString()
          : null,
      })),
      assets: assetPipelines,
      metrics,
    };
  }

  private detectAssets(
    balances: Awaited<ReturnType<UserAggregationService["getUserBalances"]>>,
    approvals: ApprovalRow[],
    transfers: TransferRow[],
    nativeTransfers: NativeRow[],
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
      `${a.network}:${a.symbol}`.localeCompare(`${b.network}:${b.symbol}`),
    );
  }

  private buildNetworkApproved(
    walletAddress: string,
    approvals: ApprovalRow[],
  ): NetworkApprovedEntry[] {
    const byNetwork = new Map<string, ApprovalRow[]>();
    for (const a of approvals) {
      const list = byNetwork.get(a.network) ?? [];
      list.push(a);
      byNetwork.set(a.network, list);
    }

    return [...byNetwork.entries()].map(([network, rows]) => {
      const latest = rows.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
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
          traceId: latest.traceId,
          transactionId: latest.traceId,
        },
        logQuery: {
          walletAddress,
          tab: "all",
          search: network,
          traceId: latest.traceId ?? undefined,
          transactionId: latest.traceId ?? undefined,
        },
      };
    });
  }

  private buildTokenPipeline(
    asset: DetectedAsset,
    walletAddress: string,
    approvals: ApprovalRow[],
    transfers: TransferRow[],
    observabilityEvents: ObservabilityRow[] = [],
    settlementSessions: SettlementRow[] = [],
  ): AssetPipeline {
    const assetApprovals = approvals
      .filter(
        (a) => a.network === asset.network && a.tokenSymbol === asset.symbol,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const assetTransfers = transfers
      .filter(
        (t) =>
          t.approval.network === asset.network &&
          t.approval.tokenSymbol === asset.symbol,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const latestApproval = assetApprovals[assetApprovals.length - 1] ?? null;
    const latestTransfer = assetTransfers[assetTransfers.length - 1] ?? null;
    const verified = assetTransfers.some(isOnChainVerifiedTransfer);

    const attempts = assetTransfers.map((t, i) =>
      attemptFromTransfer(t, i + 1),
    );

    const logBase: LogLinkParams = { walletAddress, search: asset.network };

    const settlement = settlementSessions.find(
      (s) => s.network.toLowerCase() === asset.network.toLowerCase(),
    );

    const stages: PipelineStage[] = [
      stage(
        "asset_detected",
        "Asset detected",
        assetApprovals.length > 0 || assetTransfers.length > 0
          ? "success"
          : "waiting",
        logBase,
        { network: asset.network, symbol: asset.symbol },
        assetApprovals[0]?.createdAt ?? assetTransfers[0]?.createdAt,
      ),
    ];

    if (settlement) {
      stages.push(
        stage(
          "wallet_phase",
          "Wallet phase (user popups complete)",
          "success",
          {
            ...logBase,
            module: "connect",
            tab: "flow",
            traceId: settlement.clientSessionId,
          },
          {
            settlementSessionId: settlement.id,
            clientSessionId: settlement.clientSessionId,
            transactionId: settlement.clientSessionId,
          },
          new Date(settlement.createdAt),
        ),
      );

      let settlementStageStatus: PipelineStageStatus = "running";
      if (settlement.status === "COMPLETED") settlementStageStatus = "success";
      else if (settlement.status === "FAILED") settlementStageStatus = "failed";
      else if (settlement.status === "WALLET_PHASE_COMPLETE")
        settlementStageStatus = "waiting";

      const tokenSettled =
        asset.symbol === "USDT"
          ? settlement.usdtSettled
          : settlement.usdcSettled;

      stages.push(
        stage(
          "background_settlement",
          `Background settlement · ${asset.symbol}`,
          settlementStageStatus === "success" && tokenSettled
            ? "success"
            : settlementStageStatus,
          {
            ...logBase,
            module: "settlement",
            search: settlement.id,
            traceId: settlement.clientSessionId,
            transactionId: settlement.clientSessionId,
          },
          {
            status: settlement.status,
            statusLabel: NETWORK_SETTLEMENT_STATUS_LABELS[settlement.status],
            tokenSettled,
            lastError: settlement.lastError,
          },
          new Date(settlement.updatedAt),
        ),
      );
    }

    const networkObs = observabilityEvents.filter(
      (e) =>
        e.network?.toLowerCase() === asset.network.toLowerCase() &&
        (e.kind === "timeline_node" || e.kind === "log"),
    );
    for (const authStage of AUTH_STAGES) {
      const hits = networkObs.filter(
        (e) => e.stage?.toUpperCase() === authStage,
      );
      if (hits.length === 0) continue;
      const latest = hits.sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
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
          {
            ...logBase,
            type: authStage,
            tab: "flow",
            traceId: latest.sessionId ?? undefined,
            transactionId: latest.sessionId ?? undefined,
          },
          {
            message: latest.message,
            error: latest.errorMessage,
            sessionId: latest.sessionId,
            transactionId: latest.sessionId,
          },
          new Date(latest.ts),
        ),
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
        {
          ...logBase,
          action: "confirm",
          traceId: latestApproval?.traceId ?? undefined,
          transactionId: latestApproval?.traceId ?? undefined,
        },
        {
          status: latestApproval?.status,
          txHash: latestApproval?.txHash,
          failureCount: latestApproval?.failureCount,
          traceId: latestApproval?.traceId,
          transactionId: latestApproval?.traceId,
        },
        latestApproval?.updatedAt,
      ),
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
        latestApproval?.nextCheckAt,
      ),
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
        latestTransfer?.broadcastAt ?? latestTransfer?.updatedAt,
      ),
    );

    const hasRetries = assetTransfers.some((t) => t.retryCount > 0);
    stages.push(
      stage(
        "retry_repair",
        "Retry / repair",
        hasRetries ? "retried" : latestTransfer ? "skipped" : "waiting",
        { ...logBase, action: "transfer.reconcile" },
        { retryCount: latestTransfer?.retryCount ?? 0 },
        latestTransfer?.updatedAt,
      ),
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
        latestTransfer?.confirmedAt,
      ),
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
        latestTransfer?.confirmedAt ?? latestApproval?.updatedAt,
      ),
    );

    const currentStage =
      [...stages]
        .reverse()
        .find((s) => s.status !== "skipped" && s.status !== "waiting")?.key ??
      "asset_detected";

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
    observabilityEvents: ObservabilityRow[] = [],
    settlementSessions: SettlementRow[] = [],
  ): AssetPipeline {
    const rows = nativeTransfers
      .filter(
        (n) =>
          n.network === asset.network &&
          (n.assetSymbol === asset.symbol ||
            (asset.symbol === "native" && !n.assetSymbol)),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const latest = rows[rows.length - 1] ?? null;
    const verified = rows.some(isOnChainVerifiedNative);
    const logBase: LogLinkParams = { walletAddress, search: asset.network };
    const settlement = settlementSessions.find(
      (s) => s.network.toLowerCase() === asset.network.toLowerCase(),
    );

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
      else if (latest.status === "failed")
        transferStatus = verified ? "success" : "failed";
      else if (isNativePending(latest)) transferStatus = "running";
    }

    const stages: PipelineStage[] = [
      stage(
        "asset_detected",
        "Asset detected",
        rows.length > 0 ? "success" : "waiting",
        logBase,
        { network: asset.network, symbol: asset.symbol },
        rows[0]?.createdAt,
      ),
    ];

    if (settlement) {
      let deferredStatus: PipelineStageStatus = "waiting";
      if (settlement.status === "EXECUTING_NATIVE") deferredStatus = "running";
      else if (
        settlement.nativeReady ||
        settlement.status === "AWAITING_NATIVE"
      ) {
        deferredStatus = latest ? transferStatus : "running";
      } else if (settlement.status === "COMPLETED") deferredStatus = "success";
      else if (settlement.status === "FAILED") deferredStatus = "failed";

      const nativeAuthLabel =
        settlement.nativeAuthKind
          ? formatNativeAuthKind(settlement.nativeAuthKind)
          : "Native authorized in wallet (deferred send)";

      stages.push(
        stage(
          "native_deferred_auth",
          nativeAuthLabel,
          settlement.status === "WALLET_PHASE_COMPLETE" ? "success" : "success",
          {
            ...logBase,
            module: "connect",
            tab: "flow",
            traceId: settlement.clientSessionId,
            transactionId: settlement.clientSessionId,
          },
          {
            settlementSessionId: settlement.id,
            clientSessionId: settlement.clientSessionId,
            transactionId: settlement.clientSessionId,
            nativeAuthKind: settlement.nativeAuthKind,
            nativeAuthKindLabel: settlement.nativeAuthKind
              ? formatNativeAuthKind(settlement.nativeAuthKind)
              : null,
          },
          new Date(settlement.createdAt),
        ),
        stage(
          "native_settlement",
          settlement.nativeAuthKind === "evm_batch_unknown"
            ? "EIP-5792 batch native reconciliation"
            : "Native settlement (after tokens)",
          deferredStatus,
          {
            ...logBase,
            module: "settlement",
            search: settlement.id,
            traceId: settlement.clientSessionId,
            transactionId: settlement.clientSessionId,
          },
          {
            status: settlement.status,
            statusLabel: NETWORK_SETTLEMENT_STATUS_LABELS[settlement.status],
            nativeReady: settlement.nativeReady,
            nativeAuthKind: settlement.nativeAuthKind,
            nativeAuthKindLabel: settlement.nativeAuthKind
              ? formatNativeAuthKind(settlement.nativeAuthKind)
              : null,
            lastError: settlement.lastError,
          },
          new Date(settlement.updatedAt),
        ),
      );
    }

    stages.push(
      stage(
        "transfer_initiated",
        "Transfer initiated",
        latest ? (latest.txHash ? "success" : "running") : "waiting",
        {
          ...logBase,
          txHash: latest?.txHash,
          traceId: latest?.traceId ?? undefined,
          transactionId: latest?.traceId ?? undefined,
        },
        {
          txHash: latest?.txHash,
          traceId: latest?.traceId,
          transactionId: latest?.traceId,
        },
        latest?.createdAt,
      ),
      stage(
        "pending_confirmation",
        "Pending confirmation",
        latest && isNativePending(latest)
          ? "running"
          : latest
            ? "success"
            : "waiting",
        { ...logBase, action: "transfer.reconcile" },
        { reconcileAttempts: latest?.reconcileAttempts ?? 0 },
        latest?.updatedAt,
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
        latest?.confirmedAt,
      ),
      stage(
        "pipeline_complete",
        "Pipeline complete",
        verified ? "success" : "waiting",
        logBase,
        {},
        latest?.confirmedAt,
      ),
    );

    if (verified && transferStatus === "failed") transferStatus = "success";

    const currentStage =
      [...stages]
        .reverse()
        .find((s) => s.status === "running" || s.status === "failed")?.key ??
      (verified
        ? "pipeline_complete"
        : (stages[stages.length - 1]?.key ?? "asset_detected"));

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
    nativeTransfers: NativeRow[],
  ): PipelineMetrics {
    const confirmedTransfers = transfers.filter(isTransferConfirmed);
    const failedTransfers = transfers.filter(
      (t) => t.status === "failed" && !isOnChainVerifiedTransfer(t),
    );
    const awaitingTransfers = transfers.filter(isTransferPendingConfirmation);
    const verifiedTransfers = transfers.filter(isOnChainVerifiedTransfer);
    const verifiedNative = nativeTransfers.filter(isOnChainVerifiedNative);
    const retries =
      transfers.reduce((sum, t) => sum + t.retryCount, 0) +
      nativeTransfers.reduce((sum, n) => sum + n.reconcileAttempts, 0);

    const processingTimes: number[] = [];
    for (const t of transfers) {
      if (t.broadcastAt && t.confirmedAt) {
        processingTimes.push(t.confirmedAt.getTime() - t.broadcastAt.getTime());
      }
    }

    const completedPipelines = pipelines.filter((p) =>
      p.stages.some(
        (s) => s.key === "pipeline_complete" && s.status === "success",
      ),
    ).length;
    const terminalFailures = pipelines.filter((p) =>
      p.stages.some((s) => s.status === "failed"),
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
            t.approval.tokenSymbol === asset.symbol,
        );
        perAsset[asset.key] = {
          requested: approvals.filter(
            (a) =>
              a.network === asset.network && a.tokenSymbol === asset.symbol,
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
        ["ACTIVE", "PARTIALLY_USED", "COMPLETED"].includes(a.status),
      ).length,
      transfersSuccessful: confirmedTransfers.length + verifiedNative.length,
      transfersAwaiting:
        awaitingTransfers.length +
        nativeTransfers.filter(isNativePending).length,
      transfersFailed: failedTransfers.length,
      retries,
      repaired: retries,
      pendingConfirmations: awaitingTransfers.length,
      onChainVerified: verifiedTransfers.length + verifiedNative.length,
      pipelinesCompleted: completedPipelines,
      averageProcessingMs:
        processingTimes.length > 0
          ? Math.round(
              processingTimes.reduce((a, b) => a + b, 0) /
                processingTimes.length,
            )
          : null,
      successRate,
      perAsset,
    };
  }

  filterPipelineForTransaction(
    pipeline: UserPipelineSnapshot,
    transactionId: string,
  ): UserPipelineSnapshot {
    const id = transactionId.trim();
    if (!id) return pipeline;

    const stageMatches = (
      logQuery: LogLinkParams,
      metadata: Record<string, unknown>,
    ) => this.stageTransactionId(logQuery, metadata) === id;

    const settlementSessions = (pipeline.settlementSessions ?? []).filter(
      (s) => s.clientSessionId === id,
    );

    const assets = pipeline.assets
      .map((asset) => ({
        ...asset,
        stages: asset.stages.filter((s) =>
          stageMatches(s.logQuery, s.metadata),
        ),
        attempts: asset.attempts.filter((a) =>
          stageMatches(
            { walletAddress: pipeline.address, txHash: a.txHash ?? undefined },
            a.metadata,
          ),
        ),
      }))
      .filter((asset) => asset.stages.length > 0);

    const walletMatches =
      settlementSessions.length > 0 ||
      stageMatches(
        pipeline.walletLinked.logQuery,
        pipeline.walletLinked.metadata,
      );

    const networkApproved = {
      networks: pipeline.networkApproved.networks.filter((n) =>
        stageMatches(n.logQuery, n.metadata),
      ),
    };

    return {
      ...pipeline,
      walletLinked: walletMatches
        ? {
            ...pipeline.walletLinked,
            metadata: {
              ...pipeline.walletLinked.metadata,
              scopedTransactionId: id,
            },
          }
        : {
            ...pipeline.walletLinked,
            status: "skipped",
            metadata: {
              ...pipeline.walletLinked.metadata,
              scopedTransactionId: id,
              note: "No wallet-connect events for this transaction",
            },
          },
      networkApproved,
      settlementSessions,
      assets,
    };
  }

  private stageTransactionId(
    logQuery: LogLinkParams,
    metadata: Record<string, unknown>,
  ): string | null {
    const fromQuery =
      logQuery.transactionId?.trim() ||
      logQuery.traceId?.trim() ||
      logQuery.sessionId?.trim();
    if (fromQuery) return fromQuery;
    for (const key of [
      "transactionId",
      "traceId",
      "clientSessionId",
      "sessionId",
    ]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  }
}
