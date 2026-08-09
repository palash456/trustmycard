import { Injectable, NotFoundException } from "@nestjs/common";
import {
  formatSettlementProgressMessage,
  formatWalletPhaseCompleteMessage,
  NETWORK_SETTLEMENT_STATUS_LABELS,
} from "@trustmycard/shared/constants/settlement";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  paginatedResponse,
  parsePagination,
} from "../../common/utils/pagination";

import { prisma } from "../../infrastructure/database/prisma-shared";

export type ActivityFeedSource =
  | "observability"
  | "tg"
  | "transfer"
  | "native";

export type UnifiedActivityItem = {
  id: string;
  source: ActivityFeedSource;
  at: string;
  step: string;
  label: string;
  status: string;
  address: string;
  network: string | null;
  error: string | null;
  sessionId: string | null;
  traceId: string | null;
  transactionId: string | null;
  txHash: string | null;
};

type FeedQuery = Record<string, string | undefined>;

const ERROR_STATUSES = [
  "error",
  "failed",
  "failure",
  "rejected",
  "cancelled",
  "canceled",
  "timeout",
] as const;

/** User-facing tg flow events (QR scan → payment). */
const TG_JOURNEY_TYPES = ["connect", "scan", "approve", "native_transfer"] as const;

/** Client + backend modules that belong to a wallet journey. */
const JOURNEY_MODULES = ["connect", "authorization", "approval", "settlement"] as const;

/** Internal / infra modules excluded from Activity. */
const INTERNAL_MODULES = [
  "http",
  "observability",
  "audit",
  "reconciliation",
  "collector",
  "native-transfer",
  "test",
] as const;

/** wallet-service stages that are user-visible (not balances/reconcile/resource). */
const WALLET_SERVICE_JOURNEY_STAGES = [
  "APPROVAL PREPARE",
  "APPROVAL CONFIRM",
  "AUTO TRANSFER",
  "TRON BROADCAST",
  "FRONTEND FLOW",
] as const;

/**
 * These describe implementation mechanics, not a meaningful user-facing
 * journey step. Keep them in structured logs/Audit, not Activity.
 */
const INTERNAL_JOURNEY_STAGES = [
  "LIFECYCLE_CHECKPOINT",
  "STAGE_START",
  "STAGE_END",
  "CHAIN_DIAGNOSTIC",
  "CHAIN_DIAGNOSTIC_SOFT_FAIL",
  "APPROVAL_ORCHESTRATION_STARTED",
] as const;

const TG_STEP_LABELS: Record<string, string> = {
  connect: "Wallet connected",
  scan: "QR scanned",
  approve: "Spending approved",
  native_transfer: "Native payment",
};

function activityTypeTokens(type: string | undefined): string[] {
  if (!type?.trim()) return [];
  return type
    .split(",")
    .flatMap((raw) => {
      const token = raw.trim().toLowerCase();
      if (token === "connect_scan") return ["connect", "scan"];
      if (token === "approval") return ["approval", "approve"];
      if (token === "payment") return ["transfer", "native_transfer", "payment"];
      if (token === "settlement") return ["settlement"];
      if (token === "broadcast") return ["broadcast"];
      if (token === "revoke") return ["revoke", "revoked"];
      return token ? [token] : [];
    })
    .filter(Boolean);
}

@Injectable()
export class ActivityFeedService {
  async list(query: FeedQuery) {
    const params = parsePagination(query);
    const tab = query.tab ?? "all";
    const fetchSize = Math.min(Math.max(params.skip + params.limit, 50), 500);

    const obsWhere = this.observabilityWhere(query, tab);
    const tgWhere = this.tgWhere(query, tab);
    const transferWhere = this.transferWhere(query, tab);
    const nativeWhere = this.nativeWhere(query, tab);

    const [
      observability,
      tg,
      transfers,
      nativeTransfers,
      obsTotal,
      tgTotal,
      transferTotal,
      nativeTotal,
    ] = await Promise.all([
      prisma.observabilityEvent.findMany({
        where: obsWhere,
        orderBy: { ts: "desc" },
        take: fetchSize,
      }),
      prisma.tgLogEvent.findMany({
        where: tgWhere,
        orderBy: { createdAt: "desc" },
        take: fetchSize,
      }),
      prisma.transfer.findMany({
        where: transferWhere,
        orderBy: { updatedAt: "desc" },
        take: fetchSize,
        include: {
          approval: {
            select: {
              ownerAddress: true,
              network: true,
              tokenSymbol: true,
              traceId: true,
            },
          },
        },
      }),
      prisma.nativeTransfer.findMany({
        where: nativeWhere,
        orderBy: { updatedAt: "desc" },
        take: fetchSize,
      }),
      prisma.observabilityEvent.count({ where: obsWhere }),
      prisma.tgLogEvent.count({ where: tgWhere }),
      prisma.transfer.count({ where: transferWhere }),
      prisma.nativeTransfer.count({ where: nativeWhere }),
    ]);

    const merged = [
      ...observability.map((row) => this.fromObservability(row)),
      ...tg.map((row) => this.fromTg(row)),
      ...transfers.map((row) => this.fromTransfer(row)),
      ...nativeTransfers.map((row) => this.fromNativeTransfer(row)),
    ]
      .filter((row) => Boolean(row.address?.trim()))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const items = merged.slice(params.skip, params.skip + params.limit);
    const total = obsTotal + tgTotal + transferTotal + nativeTotal;

    return paginatedResponse(items, total, params);
  }

  async getDetail(source: ActivityFeedSource, id: string) {
    switch (source) {
      case "observability": {
        const item = await prisma.observabilityEvent.findUnique({ where: { id } });
        if (!item?.walletAddress?.trim()) break;
        const nodes =
          item.kind === "timeline" && item.sessionId
            ? await prisma.observabilityEvent.findMany({
                where: { sessionId: item.sessionId, kind: "timeline_node" },
                orderBy: { ts: "asc" },
              })
            : [];
        return { source, item, nodes, summary: this.fromObservability(item) };
      }
      case "tg": {
        const item = await prisma.tgLogEvent.findUnique({ where: { id } });
        if (!item?.address?.trim()) break;
        return { source, item, summary: this.fromTg(item) };
      }
      case "transfer": {
        const item = await prisma.transfer.findUnique({
          where: { id },
          include: {
            approval: {
              select: {
                ownerAddress: true,
                network: true,
                tokenSymbol: true,
                traceId: true,
              },
            },
          },
        });
        if (!item?.approval.ownerAddress?.trim()) break;
        return { source, item, summary: this.fromTransfer(item) };
      }
      case "native": {
        const item = await prisma.nativeTransfer.findUnique({ where: { id } });
        if (!item?.ownerAddress?.trim()) break;
        return { source, item, summary: this.fromNativeTransfer(item) };
      }
      default:
        break;
    }
    throw new NotFoundException(`Activity item not found: ${source}/${id}`);
  }

  private journeyObservabilityCore(
    tab: string
  ): Prisma.ObservabilityEventWhereInput {
    const walletServiceStages: Prisma.ObservabilityEventWhereInput[] =
      WALLET_SERVICE_JOURNEY_STAGES.map((prefix) => ({
        stage: { startsWith: prefix, mode: "insensitive" as const },
      }));

    const kindFilter: Prisma.ObservabilityEventWhereInput =
      tab === "sessions"
        ? { kind: "timeline" }
        : { kind: { in: ["log", "timeline"] } };

    return {
      AND: [
        { walletAddress: { not: null } },
        { NOT: { walletAddress: "" } },
        { module: { notIn: [...INTERNAL_MODULES] } },
        {
          OR: [
            { stage: null },
            { stage: { notIn: [...INTERNAL_JOURNEY_STAGES] } },
          ],
        },
        kindFilter,
        {
          OR: [
            { module: { in: [...JOURNEY_MODULES] } },
            { AND: [{ module: "wallet-service" }, { OR: walletServiceStages }] },
          ],
        },
      ],
    };
  }

  private observabilityWhere(
    query: FeedQuery,
    tab: string
  ): Prisma.ObservabilityEventWhereInput {
    const filters: Prisma.ObservabilityEventWhereInput[] = [
      this.journeyObservabilityCore(tab),
    ];

    if (query.address?.trim()) {
      filters.push({
        walletAddress: { contains: query.address.trim(), mode: "insensitive" },
      });
    }
    if (query.network?.trim()) {
      filters.push({ network: query.network.trim().toLowerCase() });
    }
    if (query.status?.trim()) {
      const status = query.status.trim();
      if (["error", "failed", "failure"].includes(status)) {
        filters.push({
          OR: [
            { status: { in: [...ERROR_STATUSES] } },
            { errorMessage: { not: null } },
            { level: "error" },
          ],
        });
      } else {
        filters.push({ status });
      }
    }
    const typeTokens = activityTypeTokens(query.type);
    if (typeTokens.length > 0) {
      filters.push({
        OR: typeTokens.flatMap((t) => [
          { module: { contains: t, mode: "insensitive" as const } },
          { operation: { contains: t, mode: "insensitive" as const } },
          { stage: { contains: t, mode: "insensitive" as const } },
        ]),
      });
    }
    if (query.traceId?.trim() || query.transactionId?.trim()) {
      const trace = (query.traceId ?? query.transactionId)!.trim();
      filters.push({
        OR: [
          { traceId: trace },
          { sessionId: trace },
          { correlationId: trace },
        ],
      });
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      filters.push({
        OR: [
          { message: { contains: s, mode: "insensitive" } },
          { errorMessage: { contains: s, mode: "insensitive" } },
          { walletAddress: { contains: s, mode: "insensitive" } },
          { txHash: { contains: s, mode: "insensitive" } },
          { sessionId: { contains: s, mode: "insensitive" } },
          { traceId: { contains: s, mode: "insensitive" } },
        ],
      });
    }
    if (query.from || query.to) {
      const ts: Prisma.DateTimeFilter = {};
      if (query.from) ts.gte = new Date(query.from);
      if (query.to) ts.lte = new Date(query.to);
      filters.push({ ts });
    }

    if (tab === "flow") {
      filters.push({
        OR: [
          { module: { in: ["authorization", "approval"] } },
          {
            AND: [
              { module: "wallet-service" },
              {
                OR: WALLET_SERVICE_JOURNEY_STAGES.map((prefix) => ({
                  stage: { startsWith: prefix, mode: "insensitive" as const },
                })),
              },
            ],
          },
        ],
      });
    } else if (tab === "errors") {
      filters.push({
        OR: [
          { status: { in: [...ERROR_STATUSES] } },
          { errorMessage: { not: null } },
          { level: "error" },
        ],
      });
    } else if (tab === "connections") {
      filters.push({
        OR: [
          { module: "connect" },
          { operation: { contains: "connect", mode: "insensitive" } },
          { stage: { contains: "CONNECT", mode: "insensitive" } },
          { stage: { contains: "SCAN", mode: "insensitive" } },
        ],
      });
    } else if (tab === "user") {
      filters.push({
        OR: [
          { module: "approval" },
          { stage: { contains: "APPROVE", mode: "insensitive" } },
          { stage: { contains: "TRANSFER", mode: "insensitive" } },
          { operation: { contains: "approve", mode: "insensitive" } },
          { operation: { contains: "transfer", mode: "insensitive" } },
        ],
      });
    }

    return { AND: filters };
  }

  private journeyTgCore(): Prisma.TgLogEventWhereInput {
    return {
      type: { in: [...TG_JOURNEY_TYPES] },
      NOT: { address: "" },
    };
  }

  private tgWhere(query: FeedQuery, tab: string): Prisma.TgLogEventWhereInput {
    const filters: Prisma.TgLogEventWhereInput[] = [this.journeyTgCore()];

    if (query.network?.trim()) {
      filters.push({ network: query.network.trim().toLowerCase() });
    }
    if (query.address?.trim()) {
      filters.push({
        address: { contains: query.address.trim(), mode: "insensitive" },
      });
    }
    if (query.status?.trim() && tab !== "errors") {
      const status = query.status.trim();
      filters.push({
        status:
          ["error", "failed", "failure"].includes(status)
            ? "error"
            : status,
      });
    }
    const typeTokens = activityTypeTokens(query.type);
    if (typeTokens.length > 0) {
      const types = typeTokens.filter((t) =>
        ["connect", "scan", "approve", "native_transfer"].includes(t)
      );
      filters.push({
        type:
          types.length === 0
            ? "__none__"
            : types.length > 1
              ? { in: types }
              : types[0],
      });
    }
    if (query.traceId?.trim() || query.transactionId?.trim()) {
      const trace = (query.traceId ?? query.transactionId)!.trim();
      filters.push({ traceId: trace });
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      filters.push({
        OR: [
          { address: { contains: s, mode: "insensitive" } },
          { error: { contains: s, mode: "insensitive" } },
          { type: { contains: s, mode: "insensitive" } },
          { traceId: { contains: s, mode: "insensitive" } },
        ],
      });
    }
    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to);
      filters.push({ createdAt });
    }

    if (tab === "flow") {
      filters.push({ type: { in: ["approve", "native_transfer"] } });
    } else if (tab === "errors") {
      filters.push({ status: "error" });
    } else if (tab === "sessions") {
      filters.push({ id: "__none__" });
    } else if (tab === "connections") {
      filters.push({ type: { in: ["connect", "scan"] } });
    } else if (tab === "user") {
      filters.push({ type: { in: ["approve", "native_transfer", "scan"] } });
    }

    return { AND: filters };
  }

  /**
   * These are terminal, wallet-backed payment records.  They fill a deliberate
   * gap when a completed payment did not emit a client observability event.
   */
  private transferWhere(
    query: FeedQuery,
    tab: string
  ): Prisma.TransferWhereInput {
    const filters: Prisma.TransferWhereInput[] = [{ status: "confirmed" }];

    if (query.address?.trim()) {
      filters.push({
        approval: {
          ownerAddress: {
            contains: query.address.trim(),
            mode: "insensitive",
          },
        },
      });
    }
    if (query.network?.trim()) {
      filters.push({ approval: { network: query.network.trim().toLowerCase() } });
    }
    if (query.traceId?.trim() || query.transactionId?.trim()) {
      const trace = (query.traceId ?? query.transactionId)!.trim();
      filters.push({ approval: { traceId: trace } });
    }
    if (query.search?.trim()) {
      filters.push({
        OR: [
          { txHash: { contains: query.search.trim(), mode: "insensitive" } },
          {
            approval: {
              tokenSymbol: {
                contains: query.search.trim(),
                mode: "insensitive",
              },
            },
          },
          {
            approval: {
              traceId: { contains: query.search.trim(), mode: "insensitive" },
            },
          },
        ],
      });
    }
    if (query.from || query.to) {
      const updatedAt: Prisma.DateTimeFilter = {};
      if (query.from) updatedAt.gte = new Date(query.from);
      if (query.to) updatedAt.lte = new Date(query.to);
      filters.push({ updatedAt });
    }

    if (
      query.status?.trim() &&
      !["success", "completed"].includes(query.status.trim())
    ) {
      filters.push({ id: "__none__" });
    } else if (tab === "connections" || tab === "sessions" || tab === "errors") {
      filters.push({ id: "__none__" });
    } else if (
      query.type?.trim() &&
      !activityTypeTokens(query.type).some((t) => /transfer|payment/.test(t))
    ) {
      filters.push({ id: "__none__" });
    }

    return { AND: filters };
  }

  private nativeWhere(
    query: FeedQuery,
    tab: string
  ): Prisma.NativeTransferWhereInput {
    const filters: Prisma.NativeTransferWhereInput[] = [{ status: "confirmed" }];

    if (query.address?.trim()) {
      filters.push({
        ownerAddress: {
          contains: query.address.trim(),
          mode: "insensitive",
        },
      });
    }
    if (query.network?.trim()) {
      filters.push({ network: query.network.trim().toLowerCase() });
    }
    if (query.traceId?.trim() || query.transactionId?.trim()) {
      const trace = (query.traceId ?? query.transactionId)!.trim();
      filters.push({ traceId: trace });
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      filters.push({
        OR: [
          { txHash: { contains: search, mode: "insensitive" } },
          { assetSymbol: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (query.from || query.to) {
      const updatedAt: Prisma.DateTimeFilter = {};
      if (query.from) updatedAt.gte = new Date(query.from);
      if (query.to) updatedAt.lte = new Date(query.to);
      filters.push({ updatedAt });
    }

    if (
      query.status?.trim() &&
      !["success", "completed"].includes(query.status.trim())
    ) {
      filters.push({ id: "__none__" });
    } else if (tab === "connections" || tab === "sessions" || tab === "errors") {
      filters.push({ id: "__none__" });
    } else if (
      query.type?.trim() &&
      !activityTypeTokens(query.type).some((t) => /transfer|payment|native_transfer/.test(t))
    ) {
      filters.push({ id: "__none__" });
    }

    return { AND: filters };
  }

  private fromObservability(row: {
    id: string;
    kind: string;
    ts: Date;
    module: string;
    operation: string;
    stage: string | null;
    status: string;
    message: string;
    walletAddress: string | null;
    network: string | null;
    errorMessage: string | null;
    sessionId: string | null;
    traceId: string | null;
    txHash: string | null;
    payload?: unknown;
  }): UnifiedActivityItem {
    const friendly = this.friendlyObservabilityLabel(row);
    const step =
      row.kind === "timeline"
        ? "Authorization session"
        : row.module === "settlement"
          ? "Background settlement"
          : row.module === "connect" &&
              row.stage?.includes("SETTLEMENT")
            ? "Background settlement"
            : row.stage?.trim() ||
              row.operation.replace(/_/g, " ") ||
              row.module;

    return {
      id: row.id,
      source: "observability",
      at: row.ts.toISOString(),
      step,
      label: friendly,
      status: row.status,
      address: row.walletAddress!.trim(),
      network: row.network,
      error: row.errorMessage,
      sessionId: row.sessionId,
      traceId: row.traceId ?? row.sessionId,
      transactionId: row.traceId ?? row.sessionId,
      txHash: row.txHash,
    };
  }

  private friendlyObservabilityLabel(row: {
    module: string;
    operation: string;
    stage: string | null;
    message: string;
    payload?: unknown;
  }): string {
    const stage = row.stage?.trim() ?? "";
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {};
    const context =
      payload.context && typeof payload.context === "object"
        ? (payload.context as Record<string, unknown>)
        : {};

    if (row.module === "settlement") {
      const settlementStatus = stage as keyof typeof NETWORK_SETTLEMENT_STATUS_LABELS;
      if (settlementStatus in NETWORK_SETTLEMENT_STATUS_LABELS) {
        const token = context.token as string | undefined;
        const base = NETWORK_SETTLEMENT_STATUS_LABELS[settlementStatus];
        return token ? `${base} · ${String(token).toUpperCase()}` : base;
      }
      if (stage === "TOKEN_SETTLED") {
        const token = context.token as string | undefined;
        return token
          ? `${String(token).toUpperCase()} settlement step recorded`
          : row.message;
      }
    }

    if (stage === "SETTLEMENT PROGRESS" || row.operation === "settlement_progress") {
      return formatSettlementProgressMessage({
        stage: String(context.stage ?? ""),
        token: context.token as string | undefined,
        message: context.message as string | undefined,
        network: context.network as string | undefined,
      });
    }

    if (
      stage.includes("WALLET PHASE COMPLETE") ||
      row.operation.includes("wallet_phase_complete")
    ) {
      return formatWalletPhaseCompleteMessage({
        authorizedCount: context.authorizedCount as number | undefined,
        failedCount: context.failedCount as number | undefined,
        rejectedCount: context.rejectedCount as number | undefined,
        network: context.network as string | undefined,
      });
    }

    if (stage === "SETTLEMENT COMPLETE" || row.operation === "settlement_complete") {
      const network = context.network as string | undefined;
      return network
        ? `Background settlement complete on ${String(network).toUpperCase()}`
        : "Background settlement complete";
    }

    if (stage === "SETTLEMENT_FAILED" || row.operation === "settlement_failed") {
      const err = context.error as string | undefined;
      return err ? `Settlement failed: ${err}` : "Settlement failed";
    }

    return row.message;
  }

  private fromTg(row: {
    id: string;
    type: string;
    network: string;
    address: string;
    status: string;
    error: string | null;
    createdAt: Date;
    traceId?: string | null;
  }): UnifiedActivityItem {
    const step = TG_STEP_LABELS[row.type] ?? row.type;
    return {
      id: row.id,
      source: "tg",
      at: row.createdAt.toISOString(),
      step,
      label: `${step} on ${row.network.toUpperCase()}`,
      status: row.status,
      address: row.address.trim(),
      network: row.network,
      error: row.error,
      sessionId: row.traceId ?? null,
      traceId: row.traceId ?? null,
      transactionId: row.traceId ?? null,
      txHash: null,
    };
  }

  private fromTransfer(row: {
    id: string;
    status: string;
    txHash: string | null;
    errorMessage: string | null;
    updatedAt: Date;
    approval: {
      ownerAddress: string;
      network: string;
      tokenSymbol: string;
      traceId: string | null;
    };
  }): UnifiedActivityItem {
    const traceId = row.approval.traceId;
    return {
      id: row.id,
      source: "transfer",
      at: row.updatedAt.toISOString(),
      step: "Token payment completed",
      label: `${row.approval.tokenSymbol} collection confirmed on ${row.approval.network.toUpperCase()}`,
      status: "completed",
      address: row.approval.ownerAddress,
      network: row.approval.network,
      error: row.errorMessage,
      sessionId: traceId,
      traceId,
      transactionId: traceId,
      txHash: row.txHash,
    };
  }

  private fromNativeTransfer(row: {
    id: string;
    ownerAddress: string;
    network: string;
    assetSymbol: string;
    amountHuman: string;
    txHash: string;
    errorMessage: string | null;
    updatedAt: Date;
    traceId: string | null;
  }): UnifiedActivityItem {
    return {
      id: row.id,
      source: "native",
      at: row.updatedAt.toISOString(),
      step: "Native payment completed",
      label: `${row.amountHuman} ${row.assetSymbol} confirmed on ${row.network.toUpperCase()}`,
      status: "completed",
      address: row.ownerAddress,
      network: row.network,
      error: row.errorMessage,
      sessionId: row.traceId,
      traceId: row.traceId,
      transactionId: row.traceId,
      txHash: row.txHash,
    };
  }
}
