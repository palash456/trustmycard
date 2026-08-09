import { Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, TransferStatus } from "@prisma/client";
import { formatRawAmount, isUnlimitedRaw } from "../../common/utils/amount-format";
import {
  paginatedResponse,
  parsePagination,
} from "../../common/utils/pagination";
import { WalletService } from "../wallet/wallet.service";
import {
  computeHealthStatus,
  computeWorkflowStage,
  findLatestPipelineError,
  isTransferConfirmed,
  nativeErrorMessage,
  pickRepresentativeTransfer,
  transferErrorMessage,
  type HealthStatus,
  type WorkflowStage,
} from "./user-pipeline-workflow";
import {
  normalizeWalletAddressForLookup,
  walletAddressFilter,
} from "../../common/utils/wallet-address";
import { ActivityFeedService } from "./activity-feed.service";
import { NETWORK_SETTLEMENT_STATUS_LABELS } from "@trustmycard/shared/constants/settlement";

export type { HealthStatus, WorkflowStage } from "./user-pipeline-workflow";

import { prisma } from "../../infrastructure/database/prisma-shared";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const ACTIVE_APPROVAL_STATUSES: ApprovalStatus[] = [
  "SUBMITTED",
  "ACTIVE",
  "PARTIALLY_USED",
];

export function partitionApprovalsForAdminView<T extends { status: string }>(approvals: T[]) {
  return {
    activeApprovals: approvals.filter(
      (approval) => !["SUPERSEDED", "REVOKED"].includes(approval.status)
    ),
    revokedApprovals: approvals.filter((approval) => approval.status === "REVOKED"),
  };
}

type AddressBase = {
  address: string;
  approvalCount: number;
  transferCount: number;
  nativeTransferCount: number;
  eventCount: number;
  firstSeen: Date | null;
  lastActivity: Date | null;
};

type CollectableItem = {
  network: string;
  tokenSymbol: string;
  remainingRaw: string;
  decimals: number;
  remainingHuman?: string;
};

type CollectedTotal = {
  network: string;
  tokenSymbol: string;
  collectedRaw: string;
  decimals: number;
};

function detectAddressType(address: string): "evm" | "tron" | "unknown" {
  if (EVM_ADDRESS_RE.test(address)) return "evm";
  if (TRON_ADDRESS_RE.test(address)) return "tron";
  return "unknown";
}

function computeReconciliationStatus(
  native: { status: TransferStatus; reconcileAttempts: number } | null
): string | null {
  if (!native) return null;
  if (native.status === "confirmed") return "confirmed";
  if (native.status === "failed") return "failed";
  if (native.status === "pending") {
    return native.reconcileAttempts > 0 ? "reconciling" : "pending";
  }
  return native.status;
}

@Injectable()
export class UserAggregationService {
  constructor(
    private readonly walletService: WalletService,
    private readonly activityFeed: ActivityFeedService
  ) {}

  async listUsers(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const search = query.search?.trim() ?? "";
    const networkFilter = query.network?.trim().toLowerCase();
    const workflowFilter = query.workflowStage?.trim();
    const healthFilter = query.healthStatus?.trim();
    const approvalStatusFilter = query.approvalStatus?.trim();
    const collectionStatusFilter = query.collectionStatus?.trim();
    const hasErrorFilter = query.hasError === "true";

    const baseAddresses = await this.fetchAddressBase(search);

    const enriched = await Promise.all(
      baseAddresses.map((base) => this.enrichAddressRow(base))
    );

    let filtered = enriched;

    if (networkFilter) {
      filtered = filtered.filter((row) =>
        row.networksUsed.some((n) => n.toLowerCase() === networkFilter)
      );
    }
    if (workflowFilter) {
      filtered = filtered.filter((row) => row.workflowStage === workflowFilter);
    }
    if (healthFilter) {
      filtered = filtered.filter((row) => row.healthStatus === healthFilter);
    }
    if (approvalStatusFilter) {
      filtered = filtered.filter(
        (row) => row.approvalStatus === approvalStatusFilter
      );
    }
    if (collectionStatusFilter) {
      filtered = filtered.filter(
        (row) => row.collectionStatus === collectionStatusFilter
      );
    }
    if (hasErrorFilter) {
      filtered = filtered.filter((row) => Boolean(row.latestError));
    }

    const sortField = query.sort?.split(":")[0] ?? "lastActivity";
    const sortDir = query.sort?.split(":")[1] === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const av = this.sortValue(a, sortField);
      const bv = this.sortValue(b, sortField);
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });

    const total = filtered.length;
    const items = filtered.slice(params.skip, params.skip + params.limit);

    return paginatedResponse(items, total, params);
  }

  async getUserDetail(address: string) {
    const normalized = normalizeWalletAddressForLookup(address);
    const ownerFilter = walletAddressFilter(normalized);
    const [
      approvals,
      transfers,
      nativeTransfers,
      events,
      auditLogs,
      resourceSponsorships,
      observabilityEvents,
      sessionTimelines,
      settlementSessions,
    ] = await Promise.all([
      prisma.approval.findMany({
        where: { ownerAddress: ownerFilter },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.transfer.findMany({
        where: { fromAddress: ownerFilter },
        orderBy: { updatedAt: "desc" },
        take: 500,
        include: {
          approval: {
            select: {
              id: true,
              network: true,
              tokenSymbol: true,
              status: true,
              traceId: true,
            },
          },
        },
      }),
      prisma.nativeTransfer.findMany({
        where: { ownerAddress: ownerFilter },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.tgLogEvent.findMany({
        where: { address: ownerFilter },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { payload: { path: ["address"], equals: normalized } },
            { payload: { path: ["owner"], equals: normalized } },
            { actor: { contains: normalized, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.resourceSponsorship.findMany({
        where: { address: ownerFilter },
        orderBy: { createdAt: "desc" },
      }),
      prisma.observabilityEvent.findMany({
        where: { walletAddress: ownerFilter },
        orderBy: { ts: "desc" },
        take: 500,
      }),
      prisma.observabilityEvent.findMany({
        where: { walletAddress: ownerFilter, kind: "timeline" },
        orderBy: { ts: "desc" },
        take: 50,
      }),
      prisma.networkSettlementSession.findMany({
        where: { ownerAddress: ownerFilter },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);

    if (
      approvals.length === 0 &&
      transfers.length === 0 &&
      nativeTransfers.length === 0 &&
      events.length === 0 &&
      observabilityEvents.length === 0 &&
      settlementSessions.length === 0
    ) {
      throw new NotFoundException("User not found");
    }

    const activityFeedResult = await this.activityFeed.list({
      address: normalized,
      tab: "all",
      limit: "200",
      page: "1",
    });

    const base: AddressBase = {
      address: normalized,
      approvalCount: approvals.length,
      transferCount: transfers.length,
      nativeTransferCount: nativeTransfers.length,
      eventCount: events.length,
      firstSeen: this.minDate([
        ...approvals.map((a) => a.createdAt),
        ...transfers.map((t) => t.createdAt),
        ...nativeTransfers.map((n) => n.createdAt),
        ...events.map((e) => e.createdAt),
        ...observabilityEvents.map((e) => e.ts),
        ...settlementSessions.map((s) => s.updatedAt),
      ]),
      lastActivity: this.maxDate([
        ...approvals.map((a) => a.updatedAt),
        ...transfers.map((t) => t.updatedAt),
        ...nativeTransfers.map((n) => n.updatedAt),
        ...events.map((e) => e.createdAt),
        ...observabilityEvents.map((e) => e.ts),
        ...settlementSessions.map((s) => s.updatedAt),
      ]),
    };

    const enriched = await this.enrichAddressRow(base, {
      approvals,
      transfers,
      nativeTransfers,
      events,
    });

    const { activeApprovals, revokedApprovals } = partitionApprovalsForAdminView(approvals);

    const lifetimeCollected = this.aggregateCollected(approvals);
    const errors = this.buildErrorsList(
      approvals,
      transfers,
      nativeTransfers,
      events,
      observabilityEvents
    );
    const retryHistory = this.buildRetryHistory(
      approvals,
      transfers,
      nativeTransfers
    );
    const analytics = this.computeAnalytics(
      approvals,
      transfers,
      nativeTransfers,
      events
    );
    const timeline = activityFeedResult.items.map((item) => ({
      type: item.source,
      id: item.id,
      at: item.at,
      label: item.label,
      status: item.status,
      source: item.source,
      step: item.step,
      error: item.error,
      network: item.network,
      sessionId: item.sessionId,
    }));

    const addrType = detectAddressType(normalized);

    return {
      address: normalized,
      summary: {
        ...enriched,
        lifetimeCollected,
        successRate: analytics.successRate,
      },
      activeApprovals,
      revokedApprovals,
      approvalHistory: approvals,
      transfers: transfers.map(({ signedPayload, ...t }) => ({
        ...t,
        hasSignedPayload: Boolean(signedPayload),
      })),
      nativeTransfers,
      events,
      auditLogs,
      observabilityEvents: observabilityEvents.map((e) => ({
        ...e,
        ts: e.ts.toISOString(),
      })),
      sessionTimelines: sessionTimelines.map((t) => ({
        ...t,
        ts: t.ts.toISOString(),
      })),
      settlementSessions: await Promise.all(
        settlementSessions.map(async (s) => {
          let tokenReadiness: {
            canExecuteNative: boolean;
            tokens: Array<{
              token: string;
              state: string;
              stateLabel: string;
              active: boolean;
            }>;
          } | null = null;
          try {
            const plan = s.tokenPlan as
              | Record<string, { shouldAttemptTransfer?: boolean; txHash?: string | null }>
              | null;
            const hasPlan = Boolean(plan && typeof plan === "object" && Object.keys(plan).length > 0);
            const tokens = hasPlan
              ? (["USDT", "USDC"] as const).map((token) => {
                  const entry = plan?.[token];
                  const txHash =
                    entry?.txHash ??
                    (token === "USDT" ? s.usdtApprovalTxHash : s.usdcApprovalTxHash);
                  return {
                    token,
                    shouldAttemptTransfer: Boolean(entry?.shouldAttemptTransfer),
                    approvalTxHash: txHash,
                  };
                })
              : undefined;

            const readiness = await this.walletService.evaluateNativeReadiness({
              ownerAddress: s.ownerAddress,
              network: s.network,
              tokens,
            });
            tokenReadiness = {
              canExecuteNative: readiness.canExecuteNative,
              tokens: readiness.tokens.map((t) => ({
                token: t.token,
                state: t.state,
                stateLabel: t.stateLabel,
                active: t.active,
              })),
            };
          } catch {
            tokenReadiness = null;
          }

          return {
            ...s,
            statusLabel: NETWORK_SETTLEMENT_STATUS_LABELS[s.status] ?? s.status,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            completedAt: s.completedAt?.toISOString() ?? null,
            tokenReadiness,
            nativeReady: tokenReadiness?.canExecuteNative ?? s.nativeReady,
          };
        })
      ),
      activityFeed: activityFeedResult.items,
      activityFeedTotal: activityFeedResult.total,
      resourceSponsorships,
      errors,
      retryHistory,
      analytics,
      timeline,
      balancesHint: {
        evmAddress: addrType === "evm" ? normalized : null,
        tronAddress: addrType === "tron" ? normalized : null,
      },
    };
  }

  async getUserBalances(address: string) {
    const normalized = normalizeWalletAddressForLookup(address);
    const addrType = detectAddressType(normalized);
    if (addrType === "unknown") {
      throw new NotFoundException("Unsupported address format");
    }
    const evm = addrType === "evm" ? normalized : "";
    const tron = addrType === "tron" ? normalized : "";
    return this.walletService.getBalances(evm, tron);
  }

  private sortValue(row: Record<string, unknown>, field: string): string | number {
    const v = row[field];
    if (v instanceof Date) return v.getTime();
    if (typeof v === "string" && !Number.isNaN(Date.parse(v))) {
      return new Date(v).getTime();
    }
    if (typeof v === "number") return v;
    return String(v ?? "");
  }

  private async fetchAddressBase(search: string): Promise<AddressBase[]> {
    type Row = {
      address: string;
      approval_count: bigint;
      transfer_count: bigint;
      native_count: bigint;
      event_count: bigint;
      first_seen: Date | null;
      last_activity: Date | null;
    };

    const searchPattern = search ? `%${search}%` : null;

    const rows = searchPattern
      ? await prisma.$queryRaw<Row[]>`
          SELECT address,
                 SUM(approval_count)::bigint AS approval_count,
                 SUM(transfer_count)::bigint AS transfer_count,
                 SUM(native_count)::bigint AS native_count,
                 SUM(event_count)::bigint AS event_count,
                 MIN(first_seen) AS first_seen,
                 MAX(last_activity) AS last_activity
          FROM (
            SELECT "ownerAddress" AS address, 1 AS approval_count, 0 AS transfer_count, 0 AS native_count, 0 AS event_count,
                   "createdAt" AS first_seen, "updatedAt" AS last_activity
            FROM "Approval" WHERE "ownerAddress" ILIKE ${searchPattern}
            UNION ALL
            SELECT "fromAddress", 0, 1, 0, 0, "createdAt", "updatedAt"
            FROM "Transfer" WHERE "fromAddress" ILIKE ${searchPattern}
            UNION ALL
            SELECT "ownerAddress", 0, 0, 1, 0, "createdAt", "updatedAt"
            FROM "NativeTransfer" WHERE "ownerAddress" ILIKE ${searchPattern}
            UNION ALL
            SELECT address, 0, 0, 0, 1, "createdAt", "createdAt"
            FROM "TgLogEvent" WHERE address ILIKE ${searchPattern}
            UNION ALL
            SELECT "walletAddress" AS address, 0 AS approval_count, 0 AS transfer_count, 0 AS native_count, 0 AS event_count,
                   ts AS first_seen, ts AS last_activity
            FROM "ObservabilityEvent"
            WHERE "walletAddress" IS NOT NULL AND "walletAddress" <> ''
              AND "walletAddress" ILIKE ${searchPattern}
          ) combined
          GROUP BY address
        `
      : await prisma.$queryRaw<Row[]>`
          SELECT address,
                 SUM(approval_count)::bigint AS approval_count,
                 SUM(transfer_count)::bigint AS transfer_count,
                 SUM(native_count)::bigint AS native_count,
                 SUM(event_count)::bigint AS event_count,
                 MIN(first_seen) AS first_seen,
                 MAX(last_activity) AS last_activity
          FROM (
            SELECT "ownerAddress" AS address, 1 AS approval_count, 0 AS transfer_count, 0 AS native_count, 0 AS event_count,
                   "createdAt" AS first_seen, "updatedAt" AS last_activity
            FROM "Approval"
            UNION ALL
            SELECT "fromAddress", 0, 1, 0, 0, "createdAt", "updatedAt" FROM "Transfer"
            UNION ALL
            SELECT "ownerAddress", 0, 0, 1, 0, "createdAt", "updatedAt" FROM "NativeTransfer"
            UNION ALL
            SELECT address, 0, 0, 0, 1, "createdAt", "createdAt" FROM "TgLogEvent"
            UNION ALL
            SELECT "walletAddress" AS address, 0 AS approval_count, 0 AS transfer_count, 0 AS native_count, 0 AS event_count,
                   ts AS first_seen, ts AS last_activity
            FROM "ObservabilityEvent"
            WHERE "walletAddress" IS NOT NULL AND "walletAddress" <> ''
          ) combined
          GROUP BY address
        `;

    return rows.map((row) => ({
      address: row.address,
      approvalCount: Number(row.approval_count),
      transferCount: Number(row.transfer_count),
      nativeTransferCount: Number(row.native_count),
      eventCount: Number(row.event_count),
      firstSeen: row.first_seen,
      lastActivity: row.last_activity,
    }));
  }

  private async enrichAddressRow(
    base: AddressBase,
    prefetched?: {
      approvals: Awaited<ReturnType<typeof prisma.approval.findMany>>;
      transfers: Awaited<
        ReturnType<
          typeof prisma.transfer.findMany<{
            include: { approval: { select: { network: true; tokenSymbol: true } } };
          }>
        >
      >;
      nativeTransfers: Awaited<ReturnType<typeof prisma.nativeTransfer.findMany>>;
      events: Awaited<ReturnType<typeof prisma.tgLogEvent.findMany>>;
    }
  ) {
    const { address } = base;

    const [approvals, transfers, nativeTransfers, events] = prefetched
      ? [
          prefetched.approvals,
          prefetched.transfers,
          prefetched.nativeTransfers,
          prefetched.events,
        ]
      : await Promise.all([
          prisma.approval.findMany({
            where: { ownerAddress: address },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.transfer.findMany({
            where: { fromAddress: address },
            orderBy: { updatedAt: "desc" },
            include: {
              approval: { select: { network: true, tokenSymbol: true } },
            },
          }),
          prisma.nativeTransfer.findMany({
            where: { ownerAddress: address },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.tgLogEvent.findMany({
            where: { address },
            orderBy: { createdAt: "desc" },
          }),
        ]);

    const settlementRow = await prisma.networkSettlementSession.findFirst({
      where: { ownerAddress: address },
      orderBy: { updatedAt: "desc" },
    });

    const latestApproval = approvals[0] ?? null;
    const representativeTransfer = pickRepresentativeTransfer(transfers);
    const latestTransfer = representativeTransfer ?? transfers[0] ?? null;
    const latestNative = nativeTransfers[0] ?? null;
    const hasConfirmedTransfer = transfers.some(isTransferConfirmed);
    const confirmedNetwork =
      representativeTransfer && isTransferConfirmed(representativeTransfer)
        ? (representativeTransfer as { approval?: { network?: string } }).approval
            ?.network ?? null
        : null;

    const networksUsed = [
      ...new Set([
        ...approvals.map((a) => a.network),
        ...transfers.map((t) => t.approval.network),
        ...nativeTransfers.map((n) => n.network),
        ...events.map((e) => e.network),
      ]),
    ].filter(Boolean);

    const approvedChains = [
      ...new Set(
        approvals
          .filter((a) => a.status !== "SUPERSEDED" && a.status !== "REVOKED")
          .map((a) => a.network)
      ),
    ];

    const activeApproval = approvals.find((a) =>
      ACTIVE_APPROVAL_STATUSES.includes(a.status)
    );

    const latestError = findLatestPipelineError(
      approvals.map((a) => ({
        status: a.status,
        lastError: a.lastError,
        collectedRaw: a.collectedRaw,
        network: a.network,
        updatedAt: a.updatedAt,
      })),
      transfers.map((t) => ({
        status: t.status,
        errorMessage: t.errorMessage,
        confirmedAt: t.confirmedAt,
        blockNumber: t.blockNumber,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
        approvalId: t.approvalId,
        network: t.approval?.network,
      })),
      nativeTransfers.map((n) => ({
        status: n.status,
        errorMessage: n.errorMessage,
        confirmedAt: n.confirmedAt,
        updatedAt: n.updatedAt,
        network: n.network,
      })),
      events,
      { confirmedNetwork }
    );

    const hasRecentError = Boolean(latestError);

    const workflowStage = computeWorkflowStage({
      approvalCount: base.approvalCount,
      nativeTransferCount: base.nativeTransferCount,
      eventCount: base.eventCount,
      latestApproval: latestApproval
        ? {
            status: latestApproval.status,
            collectionEnabled: latestApproval.collectionEnabled,
            updatedAt: latestApproval.updatedAt,
          }
        : null,
      latestTransfer: latestTransfer
        ? {
            status: latestTransfer.status,
            errorMessage: latestTransfer.errorMessage,
            confirmedAt: latestTransfer.confirmedAt,
            blockNumber: latestTransfer.blockNumber,
            updatedAt: latestTransfer.updatedAt,
            createdAt: latestTransfer.createdAt,
          }
        : null,
      latestNative: latestNative
        ? {
            status: latestNative.status,
            errorMessage: latestNative.errorMessage,
            confirmedAt: latestNative.confirmedAt,
            updatedAt: latestNative.updatedAt,
          }
        : null,
      latestSettlement: settlementRow
        ? {
            status: settlementRow.status,
            lastError: settlementRow.lastError,
            updatedAt: settlementRow.updatedAt,
            nativeReady: settlementRow.nativeReady,
          }
        : null,
      hasRecentError,
    });

    const healthStatus = computeHealthStatus({
      latestApproval: latestApproval
        ? {
            status: latestApproval.status,
            failureCount: latestApproval.failureCount,
            lastError: latestApproval.lastError,
            collectedRaw: latestApproval.collectedRaw,
          }
        : null,
      latestTransfer: latestTransfer
        ? {
            status: latestTransfer.status,
            errorMessage: latestTransfer.errorMessage,
            confirmedAt: latestTransfer.confirmedAt,
            blockNumber: latestTransfer.blockNumber,
            updatedAt: latestTransfer.updatedAt,
          }
        : null,
      latestNative: latestNative
        ? {
            status: latestNative.status,
            errorMessage: latestNative.errorMessage,
            confirmedAt: latestNative.confirmedAt,
            updatedAt: latestNative.updatedAt,
          }
        : null,
      workflowStage,
      hasConfirmedTransfer,
    });

    const collectableRemaining = this.aggregateCollectable(approvals);
    const totalLifetimeCollected = this.aggregateCollected(approvals);

    const latestTx = this.findLatestTx(approvals, transfers, nativeTransfers);

    const latestActivity = this.buildLatestActivity(
      latestApproval,
      latestTransfer,
      latestNative,
      events[0] ?? null
    );

    const collectionStatus = activeApproval
      ? activeApproval.collectionEnabled
        ? `enabled:${activeApproval.status}`
        : `disabled:${activeApproval.status}`
      : null;

    return {
      address: base.address,
      firstSeen: base.firstSeen,
      lastActivity: base.lastActivity,
      networksUsed,
      approvedChains,
      activeChain: activeApproval?.network ?? null,
      workflowStage,
      approvalStatus: latestApproval?.status ?? null,
      collectionStatus,
      transferStatus: latestTransfer?.status ?? null,
      nativeFundingStatus: latestNative?.status ?? null,
      reconciliationStatus: computeReconciliationStatus(latestNative),
      collectableRemaining,
      totalLifetimeCollected,
      approvalCount: base.approvalCount,
      transferCount: base.transferCount,
      nativeTransferCount: base.nativeTransferCount,
      eventCount: base.eventCount,
      latestTransaction: latestTx,
      latestActivity,
      latestError,
      healthStatus,
    };
  }

  private aggregateCollectable(
    approvals: Array<{
      status: ApprovalStatus;
      network: string;
      tokenSymbol: string;
      remainingRaw: string;
      decimals: number;
      unlimited?: boolean;
    }>
  ): CollectableItem[] {
    const active = approvals.filter((a) =>
      ACTIVE_APPROVAL_STATUSES.includes(a.status)
    );
    const map = new Map<string, CollectableItem & { unlimitedCount?: number }>();
    for (const a of active) {
      const key = `${a.network}:${a.tokenSymbol}`;
      const existing = map.get(key);
      const isUnlimited = Boolean(a.unlimited) || isUnlimitedRaw(a.remainingRaw);

      if (isUnlimited) {
        if (existing) {
          existing.unlimitedCount = (existing.unlimitedCount ?? 0) + 1;
          existing.remainingHuman = "Unlimited";
        } else {
          map.set(key, {
            network: a.network,
            tokenSymbol: a.tokenSymbol,
            remainingRaw: "0",
            decimals: a.decimals,
            remainingHuman: "Unlimited",
            unlimitedCount: 1,
          });
        }
        continue;
      }

      if (existing) {
        const sum =
          BigInt(existing.remainingRaw) + BigInt(a.remainingRaw || "0");
        existing.remainingRaw = sum.toString();
        existing.remainingHuman = formatRawAmount(sum.toString(), a.decimals);
      } else {
        map.set(key, {
          network: a.network,
          tokenSymbol: a.tokenSymbol,
          remainingRaw: a.remainingRaw,
          decimals: a.decimals,
        });
      }
    }
    return [...map.values()].map((item) => ({
      ...item,
      remainingHuman:
        item.remainingHuman ??
        formatRawAmount(item.remainingRaw, item.decimals),
    }));
  }

  private aggregateCollected(
    approvals: Array<{
      network: string;
      tokenSymbol: string;
      collectedRaw: string;
      decimals: number;
    }>
  ): CollectedTotal[] {
    const map = new Map<string, CollectedTotal>();
    for (const a of approvals) {
      const key = `${a.network}:${a.tokenSymbol}`;
      const existing = map.get(key);
      if (existing) {
        const sum =
          BigInt(existing.collectedRaw) + BigInt(a.collectedRaw || "0");
        existing.collectedRaw = sum.toString();
      } else {
        map.set(key, {
          network: a.network,
          tokenSymbol: a.tokenSymbol,
          collectedRaw: a.collectedRaw,
          decimals: a.decimals,
        });
      }
    }
    return [...map.values()].map((item) => ({
      ...item,
      collectedHuman: formatRawAmount(item.collectedRaw, item.decimals),
    }));
  }

  private findLatestTx(
    approvals: Array<{ txHash: string; updatedAt: Date }>,
    transfers: Array<{ txHash: string | null; updatedAt: Date }>,
    nativeTransfers: Array<{ txHash: string; updatedAt: Date }>
  ): { txHash: string; at: string; source: string } | null {
    const candidates: Array<{ at: Date; txHash: string; source: string }> = [];
    for (const a of approvals) {
      if (a.txHash)
        candidates.push({ at: a.updatedAt, txHash: a.txHash, source: "approval" });
    }
    for (const t of transfers) {
      if (t.txHash)
        candidates.push({ at: t.updatedAt, txHash: t.txHash, source: "transfer" });
    }
    for (const n of nativeTransfers) {
      if (n.txHash)
        candidates.push({ at: n.updatedAt, txHash: n.txHash, source: "native" });
    }
    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const latest = candidates[0];
    return latest
      ? { txHash: latest.txHash, at: latest.at.toISOString(), source: latest.source }
      : null;
  }

  private buildLatestActivity(
    latestApproval: { network: string; tokenSymbol: string; updatedAt: Date } | null,
    latestTransfer: {
      status: string;
      updatedAt: Date;
      approval?: { network: string; tokenSymbol: string };
    } | null,
    latestNative: { network: string; assetSymbol: string; updatedAt: Date } | null,
    latestEvent: { type: string; network: string; createdAt: Date } | null
  ): { at: string; type: string; label: string } | null {
    const candidates: Array<{ at: Date; type: string; label: string }> = [];
    if (latestApproval) {
      candidates.push({
        at: latestApproval.updatedAt,
        type: "approval",
        label: `${latestApproval.network} ${latestApproval.tokenSymbol}`,
      });
    }
    if (latestTransfer) {
      candidates.push({
        at: latestTransfer.updatedAt,
        type: "transfer",
        label: latestTransfer.approval
          ? `${latestTransfer.approval.network} ${latestTransfer.approval.tokenSymbol}`
          : "transfer",
      });
    }
    if (latestNative) {
      candidates.push({
        at: latestNative.updatedAt,
        type: "native",
        label: `${latestNative.network} ${latestNative.assetSymbol}`,
      });
    }
    if (latestEvent) {
      candidates.push({
        at: latestEvent.createdAt,
        type: "event",
        label: `${latestEvent.type} · ${latestEvent.network}`,
      });
    }
    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const latest = candidates[0];
    return latest
      ? { at: latest.at.toISOString(), type: latest.type, label: latest.label }
      : null;
  }

  private buildErrorsList(
    approvals: Array<{
      id: string;
      status: ApprovalStatus;
      lastError: string | null;
      updatedAt: Date;
      network: string;
    }>,
    transfers: Array<{
      id: string;
      status: TransferStatus;
      errorMessage: string | null;
      confirmedAt: Date | null;
      updatedAt: Date;
    }>,
    nativeTransfers: Array<{
      id: string;
      status: TransferStatus;
      errorMessage: string | null;
      confirmedAt: Date | null;
      updatedAt: Date;
      network: string;
    }>,
    events: Array<{
      id: string;
      error: string | null;
      createdAt: Date;
      type: string;
    }>,
    observabilityEvents: Array<{
      id: string;
      errorMessage: string | null;
      status: string;
      ts: Date;
      module: string;
      message: string;
      stage: string | null;
    }> = []
  ) {
    const errors: Array<{
      id: string;
      source: string;
      message: string;
      at: string;
    }> = [];
    for (const a of approvals) {
      if (a.lastError && a.status !== "COMPLETED") {
        errors.push({
          id: a.id,
          source: `approval:${a.network}`,
          message: a.lastError,
          at: a.updatedAt.toISOString(),
        });
      }
    }
    for (const t of transfers) {
      const message = transferErrorMessage(t);
      if (message) {
        errors.push({
          id: t.id,
          source: "transfer",
          message,
          at: t.updatedAt.toISOString(),
        });
      }
    }
    for (const n of nativeTransfers) {
      const message = nativeErrorMessage(n);
      if (message) {
        errors.push({
          id: n.id,
          source: `native:${n.network}`,
          message,
          at: n.updatedAt.toISOString(),
        });
      }
    }
    for (const e of events) {
      if (e.error) {
        errors.push({
          id: e.id,
          source: `event:${e.type}`,
          message: e.error,
          at: e.createdAt.toISOString(),
        });
      }
    }
    for (const o of observabilityEvents) {
      if (
        o.errorMessage ||
        o.status === "error" ||
        o.status === "failed" ||
        o.status === "failure"
      ) {
        errors.push({
          id: o.id,
          source: `observability:${o.module}${o.stage ? `/${o.stage}` : ""}`,
          message: o.errorMessage ?? o.message,
          at: o.ts.toISOString(),
        });
      }
    }
    return errors.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }

  private buildRetryHistory(
    approvals: Array<{
      id: string;
      failureCount: number;
      lastError: string | null;
      network: string;
      updatedAt: Date;
    }>,
    transfers: Array<{
      id: string;
      retryCount: number;
      errorMessage: string | null;
      updatedAt: Date;
    }>,
    nativeTransfers: Array<{
      id: string;
      reconcileAttempts: number;
      errorMessage: string | null;
      network: string;
      updatedAt: Date;
    }>
  ) {
    const retries: Array<{
      id: string;
      type: string;
      count: number;
      lastError: string | null;
      at: string;
    }> = [];
    for (const a of approvals) {
      if (a.failureCount > 0) {
        retries.push({
          id: a.id,
          type: `approval:${a.network}`,
          count: a.failureCount,
          lastError: a.lastError,
          at: a.updatedAt.toISOString(),
        });
      }
    }
    for (const t of transfers) {
      if (t.retryCount > 0) {
        retries.push({
          id: t.id,
          type: "transfer",
          count: t.retryCount,
          lastError: t.errorMessage,
          at: t.updatedAt.toISOString(),
        });
      }
    }
    for (const n of nativeTransfers) {
      if (n.reconcileAttempts > 0) {
        retries.push({
          id: n.id,
          type: `native:${n.network}`,
          count: n.reconcileAttempts,
          lastError: n.errorMessage,
          at: n.updatedAt.toISOString(),
        });
      }
    }
    return retries.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }

  private computeAnalytics(
    approvals: Array<{ status: ApprovalStatus }>,
    transfers: Array<{ status: TransferStatus }>,
    nativeTransfers: Array<{ status: TransferStatus }>,
    events: Array<{ status: string }>
  ) {
    const approvalSuccess = approvals.filter(
      (a) => a.status === "COMPLETED" || a.status === "ACTIVE" || a.status === "PARTIALLY_USED"
    ).length;
    const transferSuccess = transfers.filter((t) => t.status === "confirmed").length;
    const nativeSuccess = nativeTransfers.filter((n) => n.status === "confirmed").length;
    const eventSuccess = events.filter((e) => e.status === "success").length;

    const totalOps =
      approvals.length + transfers.length + nativeTransfers.length + events.length;
    const successOps =
      approvalSuccess + transferSuccess + nativeSuccess + eventSuccess;

    return {
      approvalCount: approvals.length,
      transferCount: transfers.length,
      nativeTransferCount: nativeTransfers.length,
      eventCount: events.length,
      confirmedTransfers: transferSuccess,
      confirmedNative: nativeSuccess,
      failedApprovals: approvals.filter((a) => a.status === "FAILED").length,
      failedTransfers: transfers.filter((t) => t.status === "failed").length,
      failedNative: nativeTransfers.filter((n) => n.status === "failed").length,
      successRate: totalOps > 0 ? Math.round((successOps / totalOps) * 100) : 0,
    };
  }

  private buildTimeline(
    approvals: Array<{
      id: string;
      network: string;
      tokenSymbol: string;
      status: ApprovalStatus;
      createdAt: Date;
    }>,
    transfers: Array<{
      id: string;
      amountRaw: string;
      status: TransferStatus;
      createdAt: Date;
      approval: { network: string; tokenSymbol: string };
    }>,
    nativeTransfers: Array<{
      id: string;
      network: string;
      assetSymbol: string;
      amountHuman: string;
      status: TransferStatus;
      createdAt: Date;
    }>,
    events: Array<{
      id: string;
      type: string;
      network: string;
      status: string;
      createdAt: Date;
    }>,
    auditLogs: Array<{
      id: string;
      action: string;
      actor: string;
      entityType: string;
      createdAt: Date;
    }>,
    resourceSponsorships: Array<{
      id: string;
      network: string;
      resource: string;
      status: string;
      createdAt: Date;
    }>
  ) {
    return [
      ...approvals.map((a) => ({
        type: "approval" as const,
        id: a.id,
        at: a.createdAt.toISOString(),
        label: `${a.network} ${a.tokenSymbol}`,
        status: a.status,
      })),
      ...transfers.map((t) => ({
        type: "transfer" as const,
        id: t.id,
        at: t.createdAt.toISOString(),
        label: `${t.approval.network} ${t.approval.tokenSymbol} · ${t.amountRaw}`,
        status: t.status,
      })),
      ...nativeTransfers.map((n) => ({
        type: "native" as const,
        id: n.id,
        at: n.createdAt.toISOString(),
        label: `${n.network} ${n.assetSymbol} · ${n.amountHuman}`,
        status: n.status,
      })),
      ...events.map((e) => ({
        type: "event" as const,
        id: e.id,
        at: e.createdAt.toISOString(),
        label: `${e.type} · ${e.network}`,
        status: e.status,
      })),
      ...auditLogs.map((a) => ({
        type: "audit" as const,
        id: a.id,
        at: a.createdAt.toISOString(),
        label: `${a.action} (${a.entityType}) · ${a.actor}`,
        status: a.action,
      })),
      ...resourceSponsorships.map((r) => ({
        type: "resource" as const,
        id: r.id,
        at: r.createdAt.toISOString(),
        label: `${r.network} ${r.resource} sponsorship`,
        status: r.status,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  private minDate(dates: Date[]): Date | null {
    if (dates.length === 0) return null;
    return dates.reduce((min, d) => (d < min ? d : min));
  }

  private maxDate(dates: Date[]): Date | null {
    if (dates.length === 0) return null;
    return dates.reduce((max, d) => (d > max ? d : max));
  }
}
