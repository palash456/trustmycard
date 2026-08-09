import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { NETWORK_SETTLEMENT_STATUS_LABELS } from "@trustmycard/shared/constants/settlement";
import {
  paginatedResponse,
  parsePagination,
  parseSort,
} from "../../common/utils/pagination";
import { prisma } from "../../infrastructure/database/prisma-shared";

@Injectable()
export class AdminSettlementService {
  async listSessions(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const filters: Prisma.NetworkSettlementSessionWhereInput[] = [];

    if (query.address?.trim()) {
      filters.push({
        ownerAddress: { contains: query.address.trim(), mode: "insensitive" },
      });
    }
    if (query.network?.trim()) {
      filters.push({ network: query.network.trim().toLowerCase() });
    }
    if (query.status?.trim()) {
      filters.push({
        status: query.status
          .trim()
          .toUpperCase() as Prisma.EnumNetworkSettlementStatusFilter["equals"],
      });
    }
    if (query.active === "true") {
      filters.push({
        status: {
          in: [
            "WALLET_PHASE_COMPLETE",
            "FINALIZING_APPROVALS",
            "COLLECTING_TOKENS",
            "AWAITING_NATIVE",
            "EXECUTING_NATIVE",
          ],
        },
      });
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      filters.push({
        OR: [
          { ownerAddress: { contains: s, mode: "insensitive" } },
          { clientSessionId: { contains: s, mode: "insensitive" } },
          { id: { contains: s, mode: "insensitive" } },
          { lastError: { contains: s, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.NetworkSettlementSessionWhereInput =
      filters.length > 0 ? { AND: filters } : {};

    const orderBy = parseSort(query.sort, [
      "createdAt",
      "updatedAt",
      "completedAt",
      "status",
    ]);

    const [items, total] = await Promise.all([
      prisma.networkSettlementSession.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.networkSettlementSession.count({ where }),
    ]);

    return paginatedResponse(
      items.map((row) => this.serializeSession(row)),
      total,
      params,
    );
  }

  async getSession(id: string) {
    const session = await prisma.networkSettlementSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException("Settlement session not found");

    const [observabilityEvents, usdtApproval, usdcApproval] = await Promise.all(
      [
        prisma.observabilityEvent.findMany({
          where: {
            OR: [
              { correlationId: id },
              {
                AND: [
                  { module: "settlement" },
                  { walletAddress: session.ownerAddress },
                  { network: session.network },
                ],
              },
            ],
          },
          orderBy: { ts: "desc" },
          take: 100,
        }),
        session.usdtApprovalId
          ? prisma.approval.findUnique({
              where: { id: session.usdtApprovalId },
            })
          : Promise.resolve(null),
        session.usdcApprovalId
          ? prisma.approval.findUnique({
              where: { id: session.usdcApprovalId },
            })
          : Promise.resolve(null),
      ],
    );

    return {
      ...this.serializeSession(session),
      observabilityEvents: observabilityEvents.map((e) => ({
        ...e,
        ts: e.ts.toISOString(),
      })),
      usdtApproval,
      usdcApproval,
    };
  }

  async getDashboardCounts() {
    const [byStatus, active, recentFailed] = await Promise.all([
      prisma.networkSettlementSession.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
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
    ]);

    return {
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      active,
      recentFailed,
    };
  }

  private serializeSession(row: {
    id: string;
    clientSessionId: string;
    ownerAddress: string;
    network: string;
    status: keyof typeof NETWORK_SETTLEMENT_STATUS_LABELS;
    usdtApprovalTxHash: string | null;
    usdcApprovalTxHash: string | null;
    usdtApprovalId: string | null;
    usdcApprovalId: string | null;
    usdtSettled: boolean;
    usdcSettled: boolean;
    batchId: string | null;
    nativeAuthKind: string | null;
    nativeEstimateRaw: string | null;
    nativeRecipient: string | null;
    nativeReady: boolean;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }) {
    return {
      ...row,
      statusLabel: NETWORK_SETTLEMENT_STATUS_LABELS[row.status] ?? row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
