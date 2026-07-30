import { Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, PrismaClient, TransferStatus } from "@prisma/client";
import { formatRawAmount, isUnlimitedRaw } from "../../common/utils/amount-format";
import {
  paginatedResponse,
  parsePagination,
} from "../../common/utils/pagination";
import { WalletService } from "../wallet/wallet.service";

const prisma = new PrismaClient();

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const ACTIVE_APPROVAL_STATUSES: ApprovalStatus[] = [
  "SUBMITTED",
  "ACTIVE",
  "PARTIALLY_USED",
];

export type WorkflowStage =
  | "idle"
  | "connected"
  | "approving"
  | "approved"
  | "collecting"
  | "completed"
  | "native_pending"
  | "failed";

export type HealthStatus = "healthy" | "warning" | "error" | "idle";

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

export function computeWorkflowStage(args: {
  approvalCount: number;
  nativeTransferCount: number;
  eventCount: number;
  latestApproval: {
    status: ApprovalStatus;
    collectionEnabled: boolean;
    updatedAt: Date;
  } | null;
  latestTransfer: { status: TransferStatus; createdAt: Date } | null;
  latestNative: { status: TransferStatus; createdAt: Date } | null;
  hasRecentError: boolean;
}): WorkflowStage {
  const { latestApproval, latestTransfer, latestNative, hasRecentError } = args;

  if (hasRecentError) return "failed";

  if (latestNative?.status === "pending") return "native_pending";

  if (latestApproval) {
    if (latestApproval.status === "SUBMITTED") return "approving";
    if (
      latestApproval.status === "ACTIVE" &&
      !latestTransfer
    ) {
      return "approved";
    }
    if (
      latestApproval.collectionEnabled &&
      (latestApproval.status === "ACTIVE" ||
        latestApproval.status === "PARTIALLY_USED")
    ) {
      return "collecting";
    }
    if (
      latestApproval.status === "COMPLETED" ||
      latestApproval.status === "REVOKED" ||
      latestApproval.status === "EXPIRED"
    ) {
      if (!latestNative || latestNative.status === "confirmed") {
        return "completed";
      }
    }
  }

  if (args.approvalCount === 0 && args.nativeTransferCount === 0) {
    return args.eventCount > 0 ? "connected" : "idle";
  }

  if (latestApproval) {
    if (latestApproval.status === "ACTIVE") return "approved";
    if (latestApproval.status === "PARTIALLY_USED") return "collecting";
  }

  return "idle";
}

export function computeHealthStatus(args: {
  latestApproval: {
    status: ApprovalStatus;
    failureCount: number;
    lastError: string | null;
  } | null;
  latestTransfer: { status: TransferStatus; errorMessage: string | null } | null;
  latestNative: {
    status: TransferStatus;
    errorMessage: string | null;
    reconcileAttempts: number;
  } | null;
  workflowStage: WorkflowStage;
}): HealthStatus {
  const { latestApproval, latestTransfer, latestNative, workflowStage } = args;

  if (
    latestApproval?.status === "FAILED" ||
    latestTransfer?.status === "failed" ||
    latestNative?.status === "failed" ||
    (latestApproval?.failureCount ?? 0) > 0 ||
    latestApproval?.lastError ||
    latestTransfer?.errorMessage ||
    latestNative?.errorMessage
  ) {
    return "error";
  }

  if (workflowStage === "failed") return "error";

  if (
    latestNative?.status === "pending" ||
    latestTransfer?.status === "broadcast" ||
    latestTransfer?.status === "prepared" ||
    latestApproval?.status === "SUBMITTED"
  ) {
    return "warning";
  }

  if (workflowStage === "idle" || workflowStage === "connected") return "idle";

  if (
    workflowStage === "collecting" ||
    workflowStage === "completed" ||
    workflowStage === "approved" ||
    latestNative?.status === "confirmed"
  ) {
    return "healthy";
  }

  return "warning";
}

@Injectable()
export class UserAggregationService {
  constructor(private readonly walletService: WalletService) {}

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
    const normalized = address.trim();
    const [
      approvals,
      transfers,
      nativeTransfers,
      events,
      auditLogs,
      resourceSponsorships,
      observabilityEvents,
      sessionTimelines,
    ] = await Promise.all([
      prisma.approval.findMany({
        where: { ownerAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.transfer.findMany({
        where: { fromAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          approval: {
            select: {
              id: true,
              network: true,
              tokenSymbol: true,
              status: true,
              decimals: true,
            },
          },
        },
      }),
      prisma.nativeTransfer.findMany({
        where: { ownerAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.tgLogEvent.findMany({
        where: { address: normalized },
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
        where: { address: normalized },
        orderBy: { createdAt: "desc" },
      }),
      prisma.observabilityEvent.findMany({
        where: { walletAddress: normalized, kind: "log" },
        orderBy: { ts: "desc" },
        take: 50,
      }),
      prisma.observabilityEvent.findMany({
        where: { walletAddress: normalized, kind: "timeline" },
        orderBy: { ts: "desc" },
        take: 20,
      }),
    ]);

    if (
      approvals.length === 0 &&
      transfers.length === 0 &&
      nativeTransfers.length === 0 &&
      events.length === 0
    ) {
      throw new NotFoundException("User not found");
    }

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
      ]),
      lastActivity: this.maxDate([
        ...approvals.map((a) => a.updatedAt),
        ...transfers.map((t) => t.updatedAt),
        ...nativeTransfers.map((n) => n.updatedAt),
        ...events.map((e) => e.createdAt),
      ]),
    };

    const enriched = await this.enrichAddressRow(base, {
      approvals,
      transfers,
      nativeTransfers,
      events,
    });

    const activeApprovals = approvals.filter(
      (a) => a.status !== "SUPERSEDED" && a.status !== "REVOKED"
    );

    const lifetimeCollected = this.aggregateCollected(approvals);
    const errors = this.buildErrorsList(
      approvals,
      transfers,
      nativeTransfers,
      events
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
    const timeline = [
      ...this.buildTimeline(
        approvals,
        transfers,
        nativeTransfers,
        events,
        auditLogs,
        resourceSponsorships
      ),
      ...observabilityEvents.map((e) => ({
        type: "observability" as const,
        id: e.id,
        at: e.ts.toISOString(),
        label: `${e.module} · ${e.message}`,
        status: e.status,
      })),
      ...sessionTimelines.map((t) => ({
        type: "session_timeline" as const,
        id: t.id,
        at: t.ts.toISOString(),
        label: `Session ${t.sessionId ?? t.eventId}`,
        status: t.status,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const addrType = detectAddressType(normalized);

    return {
      address: normalized,
      summary: {
        ...enriched,
        lifetimeCollected,
        successRate: analytics.successRate,
      },
      activeApprovals,
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
    const normalized = address.trim();
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

    const latestApproval = approvals[0] ?? null;
    const latestTransfer = transfers[0] ?? null;
    const latestNative = nativeTransfers[0] ?? null;

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

    const latestError = this.findLatestError(
      approvals,
      transfers,
      nativeTransfers,
      events
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
        ? { status: latestTransfer.status, createdAt: latestTransfer.createdAt }
        : null,
      latestNative: latestNative
        ? { status: latestNative.status, createdAt: latestNative.createdAt }
        : null,
      hasRecentError,
    });

    const healthStatus = computeHealthStatus({
      latestApproval: latestApproval
        ? {
            status: latestApproval.status,
            failureCount: latestApproval.failureCount,
            lastError: latestApproval.lastError,
          }
        : null,
      latestTransfer: latestTransfer
        ? {
            status: latestTransfer.status,
            errorMessage: latestTransfer.errorMessage,
          }
        : null,
      latestNative: latestNative
        ? {
            status: latestNative.status,
            errorMessage: latestNative.errorMessage,
            reconcileAttempts: latestNative.reconcileAttempts,
          }
        : null,
      workflowStage,
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

  private findLatestError(
    approvals: Array<{ lastError: string | null; updatedAt: Date }>,
    transfers: Array<{ errorMessage: string | null; updatedAt: Date }>,
    nativeTransfers: Array<{ errorMessage: string | null; updatedAt: Date }>,
    events: Array<{ error: string | null; createdAt: Date }>
  ): string | null {
    const candidates: Array<{ at: Date; message: string }> = [];
    for (const a of approvals) {
      if (a.lastError) candidates.push({ at: a.updatedAt, message: a.lastError });
    }
    for (const t of transfers) {
      if (t.errorMessage)
        candidates.push({ at: t.updatedAt, message: t.errorMessage });
    }
    for (const n of nativeTransfers) {
      if (n.errorMessage)
        candidates.push({ at: n.updatedAt, message: n.errorMessage });
    }
    for (const e of events) {
      if (e.error) candidates.push({ at: e.createdAt, message: e.error });
    }
    candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    return candidates[0]?.message ?? null;
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
      lastError: string | null;
      updatedAt: Date;
      network: string;
    }>,
    transfers: Array<{
      id: string;
      errorMessage: string | null;
      updatedAt: Date;
    }>,
    nativeTransfers: Array<{
      id: string;
      errorMessage: string | null;
      updatedAt: Date;
      network: string;
    }>,
    events: Array<{
      id: string;
      error: string | null;
      createdAt: Date;
      type: string;
    }>
  ) {
    const errors: Array<{
      id: string;
      source: string;
      message: string;
      at: string;
    }> = [];
    for (const a of approvals) {
      if (a.lastError) {
        errors.push({
          id: a.id,
          source: `approval:${a.network}`,
          message: a.lastError,
          at: a.updatedAt.toISOString(),
        });
      }
    }
    for (const t of transfers) {
      if (t.errorMessage) {
        errors.push({
          id: t.id,
          source: "transfer",
          message: t.errorMessage,
          at: t.updatedAt.toISOString(),
        });
      }
    }
    for (const n of nativeTransfers) {
      if (n.errorMessage) {
        errors.push({
          id: n.id,
          source: `native:${n.network}`,
          message: n.errorMessage,
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
