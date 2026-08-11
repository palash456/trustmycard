import { Injectable, NotFoundException } from "@nestjs/common";
import {
  isTransactionTerminalStage,
  terminalStatusFromStage,
  type TransactionTerminalStatus,
} from "@trustmycard/shared/constants/transaction-lifecycle";
import {
  paginatedResponse,
  parsePagination,
} from "../../common/utils/pagination";
import { prisma } from "../../infrastructure/database/prisma-shared";
import { ObservabilityService } from "../observability/observability.service";
import { PipelineBuilderService } from "./pipeline/pipeline-builder.service";

export type TransactionListItem = {
  transactionId: string;
  terminalStatus: TransactionTerminalStatus;
  walletAddress: string | null;
  network: string | null;
  token: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  eventCount: number;
};

export type TransactionJourneyDetail = {
  transactionId: string;
  terminalStatus: TransactionTerminalStatus;
  startedAt: string | null;
  completedAt: string | null;
  walletAddress: string | null;
  network: string | null;
  token: string | null;
  timeline: Awaited<ReturnType<ObservabilityService["getSessionTimeline"]>>;
  observabilityEvents: Array<{
    id: string;
    ts: string;
    module: string;
    operation: string;
    stage: string | null;
    status: string;
    message: string;
    txHash: string | null;
  }>;
  approvals: Array<{
    id: string;
    network: string;
    tokenSymbol: string;
    status: string;
    txHash: string;
    traceId: string | null;
  }>;
  collectionIntents: Array<{
    id: string;
    approvalId: string;
    network: string;
    tokenSymbol: string;
    status: string;
    traceId: string | null;
  }>;
  transfers: Array<{
    id: string;
    network: string;
    tokenSymbol: string;
    status: string;
    txHash: string | null;
    traceId: string | null;
    createdAt: string;
  }>;
  settlementSessions: Array<{
    id: string;
    clientSessionId: string;
    network: string;
    status: string;
    traceId: string | null;
    completedAt: string | null;
  }>;
  tgEvents: Array<{
    id: string;
    type: string;
    network: string;
    address: string;
    status: string;
    createdAt: string;
    traceId: string | null;
  }>;
  nativeTransfers: Array<{
    id: string;
    network: string;
    txHash: string;
    status: string;
    traceId: string | null;
  }>;
  txHashes: string[];
  pipeline: Awaited<ReturnType<PipelineBuilderService["buildPipeline"]>> | null;
};

type ListAccumulator = {
  transactionId: string;
  walletAddress: string | null;
  network: string | null;
  tokens: Set<string>;
  startedAt: Date | null;
  lastActivityAt: Date | null;
  terminalStatus: TransactionTerminalStatus | null;
  eventCount: number;
};

const STABLECOIN_TOKENS = new Set(["USDT", "USDC"]);

function normalizeJourneyToken(
  value: string | null | undefined,
  kind: "token" | "asset" | "native",
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (STABLECOIN_TOKENS.has(upper)) return upper;
  if (kind === "native" || kind === "asset") {
    if (upper === "NATIVE") return "Native";
    return upper;
  }
  if (/^(ETH|TRX|BNB|MATIC|POL|ARB|AVAX|SOL)$/i.test(raw)) return upper;
  return upper.length <= 8 ? upper : null;
}

function formatJourneyTokens(tokens: Set<string>): string | null {
  if (tokens.size === 0) return null;
  const priority = [
    "USDT",
    "USDC",
    "Native",
    "ETH",
    "BNB",
    "TRX",
    "MATIC",
    "POL",
  ];
  return [...tokens]
    .sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    })
    .join(", ");
}

function collectJourneyTokens(args: {
  approvals: Array<{ tokenSymbol: string }>;
  transfers: Array<{ tokenSymbol: string }>;
  collectionIntents: Array<{ tokenSymbol: string }>;
  nativeTransfers: Array<{ network: string; assetSymbol?: string | null }>;
  observabilityEvents: Array<{ token?: string | null; asset?: string | null }>;
}): string | null {
  const tokens = new Set<string>();
  const add = (
    value: string | null | undefined,
    kind: "token" | "asset" | "native",
  ) => {
    const normalized = normalizeJourneyToken(value, kind);
    if (normalized) tokens.add(normalized);
  };

  for (const row of args.approvals) add(row.tokenSymbol, "token");
  for (const row of args.transfers) add(row.tokenSymbol, "token");
  for (const row of args.collectionIntents) add(row.tokenSymbol, "token");
  for (const row of args.nativeTransfers) {
    add(row.assetSymbol, "native");
    add("Native", "native");
  }
  for (const row of args.observabilityEvents) {
    add(row.token, "token");
    add(row.asset, "asset");
  }

  return formatJourneyTokens(tokens);
}

@Injectable()
export class TransactionJourneyService {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly pipelineBuilder: PipelineBuilderService,
  ) {}

  async listTransactions(query: Record<string, string | undefined>) {
    const params = parsePagination(query);
    const search =
      query.search?.trim() ||
      query.transactionId?.trim() ||
      query.traceId?.trim() ||
      undefined;
    const wallet =
      query.walletAddress?.trim() || query.address?.trim() || undefined;
    const network = query.network?.trim().toLowerCase() || undefined;
    const statusFilter = query.status?.trim().toUpperCase() as
      TransactionTerminalStatus | undefined;

    const map = new Map<string, ListAccumulator>();
    const upsert = (
      rawId: string | null | undefined,
      patch: Partial<Omit<ListAccumulator, "transactionId" | "tokens">> & {
        at?: Date;
        tokens?: string[];
      },
    ) => {
      const transactionId = rawId?.trim();
      if (!transactionId) return;
      const at = patch.at;
      const existing = map.get(transactionId);
      if (!existing) {
        map.set(transactionId, {
          transactionId,
          walletAddress: patch.walletAddress ?? null,
          network: patch.network ?? null,
          tokens: new Set(patch.tokens ?? []),
          startedAt: at ?? null,
          lastActivityAt: at ?? null,
          terminalStatus: patch.terminalStatus ?? null,
          eventCount: patch.eventCount ?? (at ? 1 : 0),
        });
        return;
      }
      if (patch.walletAddress && !existing.walletAddress) {
        existing.walletAddress = patch.walletAddress;
      }
      if (patch.network && !existing.network) {
        existing.network = patch.network;
      }
      if (at) {
        if (!existing.startedAt || at < existing.startedAt)
          existing.startedAt = at;
        if (!existing.lastActivityAt || at > existing.lastActivityAt) {
          existing.lastActivityAt = at;
        }
      }
      if (patch.terminalStatus) existing.terminalStatus = patch.terminalStatus;
      if (patch.tokens) {
        for (const token of patch.tokens) existing.tokens.add(token);
      }
      if (patch.eventCount) existing.eventCount += patch.eventCount;
      else if (at) existing.eventCount += 1;
    };

    const addToken = (
      rawId: string | null | undefined,
      value: string | null | undefined,
      kind: "token" | "asset" | "native",
    ) => {
      const token = normalizeJourneyToken(value, kind);
      if (!token) return;
      upsert(rawId, { tokens: [token] });
    };

    const [obsRows, settlements, approvals, natives, intents] =
      await Promise.all([
        prisma.observabilityEvent.findMany({
          where: {
            OR: [
              { traceId: { not: null } },
              { sessionId: { startsWith: "flow-" } },
              { correlationId: { startsWith: "flow-" } },
            ],
          },
          orderBy: { ts: "desc" },
          take: 2000,
          select: {
            traceId: true,
            sessionId: true,
            correlationId: true,
            walletAddress: true,
            network: true,
            token: true,
            asset: true,
            ts: true,
            stage: true,
          },
        }),
        prisma.networkSettlementSession.findMany({
          orderBy: { updatedAt: "desc" },
          take: 500,
          select: {
            traceId: true,
            clientSessionId: true,
            ownerAddress: true,
            network: true,
            createdAt: true,
            updatedAt: true,
            status: true,
          },
        }),
        prisma.approval.findMany({
          where: { traceId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 500,
          select: {
            traceId: true,
            ownerAddress: true,
            network: true,
            tokenSymbol: true,
            createdAt: true,
            updatedAt: true,
            status: true,
          },
        }),
        prisma.nativeTransfer.findMany({
          where: { traceId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 500,
          select: {
            traceId: true,
            ownerAddress: true,
            network: true,
            assetSymbol: true,
            createdAt: true,
            updatedAt: true,
            status: true,
          },
        }),
        prisma.collectionIntent.findMany({
          where: { traceId: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 500,
          select: {
            traceId: true,
            ownerAddress: true,
            network: true,
            tokenSymbol: true,
            createdAt: true,
            updatedAt: true,
            status: true,
          },
        }),
      ]);

    for (const row of obsRows) {
      const id = row.traceId ?? row.sessionId ?? row.correlationId;
      const terminal =
        row.stage && isTransactionTerminalStage(row.stage)
          ? terminalStatusFromStage(row.stage)
          : null;
      upsert(id, {
        walletAddress: row.walletAddress,
        network: row.network,
        at: row.ts,
        terminalStatus: terminal,
      });
      addToken(id, row.token, "token");
      addToken(id, row.asset, "asset");
    }

    for (const row of settlements) {
      const id = row.traceId ?? row.clientSessionId;
      const terminal: TransactionTerminalStatus | null =
        row.status === "COMPLETED"
          ? "SUCCESS"
          : row.status === "FAILED"
            ? "FAILED"
            : null;
      upsert(id, {
        walletAddress: row.ownerAddress,
        network: row.network,
        at: row.updatedAt,
        terminalStatus: terminal,
      });
    }

    for (const row of approvals) {
      upsert(row.traceId, {
        walletAddress: row.ownerAddress,
        network: row.network,
        at: row.updatedAt,
        terminalStatus:
          row.status === "FAILED"
            ? "FAILED"
            : row.status === "COMPLETED"
              ? "SUCCESS"
              : null,
      });
      addToken(row.traceId, row.tokenSymbol, "token");
    }

    for (const row of natives) {
      upsert(row.traceId, {
        walletAddress: row.ownerAddress,
        network: row.network,
        at: row.updatedAt,
        terminalStatus:
          row.status === "failed"
            ? "FAILED"
            : row.status === "confirmed"
              ? "SUCCESS"
              : null,
      });
      addToken(row.traceId, row.assetSymbol, "native");
    }

    for (const row of intents) {
      upsert(row.traceId, {
        walletAddress: row.ownerAddress,
        network: row.network,
        at: row.updatedAt,
        terminalStatus:
          row.status === "FAILED"
            ? "FAILED"
            : row.status === "SETTLED"
              ? "SUCCESS"
              : null,
      });
      addToken(row.traceId, row.tokenSymbol, "token");
    }

    let items: TransactionListItem[] = [...map.values()]
      .map((row) => ({
        transactionId: row.transactionId,
        terminalStatus: row.terminalStatus ?? "IN_PROGRESS",
        walletAddress: row.walletAddress,
        network: row.network,
        token: formatJourneyTokens(row.tokens),
        startedAt: row.startedAt?.toISOString() ?? null,
        lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
        eventCount: row.eventCount,
      }))
      .sort((a, b) => {
        const aTs = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
        const bTs = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
        return bTs - aTs;
      });

    if (search) {
      const needle = search.toLowerCase();
      items = items.filter((i) =>
        i.transactionId.toLowerCase().includes(needle),
      );
    }
    if (wallet) {
      const needle = wallet.toLowerCase();
      items = items.filter((i) =>
        i.walletAddress?.toLowerCase().includes(needle),
      );
    }
    if (network) {
      items = items.filter((i) => i.network?.toLowerCase() === network);
    }
    if (statusFilter) {
      items = items.filter((i) => i.terminalStatus === statusFilter);
    }

    const total = items.length;
    const pageItems = items.slice(params.skip, params.skip + params.limit);
    return paginatedResponse(pageItems, total, params);
  }

  async getByTransactionId(
    transactionId: string,
  ): Promise<TransactionJourneyDetail> {
    const id = transactionId.trim();
    if (!id) throw new NotFoundException("transactionId is required");

    const [
      observabilityEvents,
      approvals,
      collectionIntents,
      transfers,
      settlementSessions,
      tgEvents,
      nativeTransfers,
      timeline,
    ] = await Promise.all([
      prisma.observabilityEvent.findMany({
        where: {
          OR: [{ traceId: id }, { sessionId: id }, { correlationId: id }],
        },
        orderBy: { ts: "asc" },
        take: 500,
      }),
      prisma.approval.findMany({
        where: { OR: [{ traceId: id }, { id }] },
        orderBy: { createdAt: "asc" },
      }),
      prisma.collectionIntent.findMany({
        where: { OR: [{ traceId: id }, { id }] },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transfer.findMany({
        where: {
          OR: [
            { approval: { traceId: id } },
            {
              attempts: {
                some: { collectionIntent: { traceId: id } },
              },
            },
          ],
        },
        orderBy: { createdAt: "asc" },
        include: {
          approval: {
            select: {
              network: true,
              tokenSymbol: true,
              traceId: true,
            },
          },
        },
      }),
      prisma.networkSettlementSession.findMany({
        where: {
          OR: [{ traceId: id }, { clientSessionId: id }, { id }],
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tgLogEvent.findMany({
        where: { OR: [{ traceId: id }, { id }] },
        orderBy: { createdAt: "asc" },
      }),
      prisma.nativeTransfer.findMany({
        where: { OR: [{ traceId: id }, { id }] },
        orderBy: { createdAt: "asc" },
      }),
      this.observability.getSessionTimeline(id),
    ]);

    const hasData =
      observabilityEvents.length > 0 ||
      approvals.length > 0 ||
      collectionIntents.length > 0 ||
      transfers.length > 0 ||
      settlementSessions.length > 0 ||
      tgEvents.length > 0 ||
      nativeTransfers.length > 0 ||
      timeline;

    if (!hasData) {
      throw new NotFoundException(`No transaction journey found for ${id}`);
    }

    const terminalEvent = [...observabilityEvents]
      .reverse()
      .find((e) => isTransactionTerminalStage(e.stage));
    const terminalFromStage = terminalEvent?.stage
      ? terminalStatusFromStage(terminalEvent.stage)
      : null;

    let terminalStatus: TransactionTerminalStatus =
      terminalFromStage ?? "IN_PROGRESS";
    if (!terminalFromStage) {
      if (settlementSessions.some((s) => s.status === "COMPLETED")) {
        terminalStatus = "SUCCESS";
      } else if (
        settlementSessions.some((s) => s.status === "FAILED") ||
        observabilityEvents.some(
          (e) =>
            e.status === "failure" && e.stage?.includes("TRANSACTION_FAILED"),
        )
      ) {
        terminalStatus = "FAILED";
      }
    }

    const walletAddress =
      observabilityEvents.find((e) => e.walletAddress)?.walletAddress ??
      approvals[0]?.ownerAddress ??
      settlementSessions[0]?.ownerAddress ??
      tgEvents[0]?.address ??
      nativeTransfers[0]?.ownerAddress ??
      transfers[0]?.fromAddress ??
      null;

    const network =
      observabilityEvents.find((e) => e.network)?.network ??
      approvals[0]?.network ??
      settlementSessions[0]?.network ??
      tgEvents[0]?.network ??
      nativeTransfers[0]?.network ??
      transfers[0]?.approval.network ??
      null;

    const startedAt =
      observabilityEvents[0]?.ts.toISOString() ??
      tgEvents[0]?.createdAt.toISOString() ??
      approvals[0]?.createdAt.toISOString() ??
      transfers[0]?.createdAt.toISOString() ??
      null;

    const completedAt =
      terminalEvent?.ts.toISOString() ??
      settlementSessions
        .find((s) => s.completedAt)
        ?.completedAt?.toISOString() ??
      null;

    const txHashes = [
      ...new Set(
        [
          ...observabilityEvents.map((e) => e.txHash),
          ...approvals.map((a) => a.txHash),
          ...nativeTransfers.map((n) => n.txHash),
          ...transfers.map((t) => t.txHash),
        ].filter((h): h is string => Boolean(h?.trim())),
      ),
    ];

    const fullPipeline = walletAddress
      ? await this.pipelineBuilder
          .buildPipeline(walletAddress)
          .catch(() => null)
      : null;
    const pipeline = fullPipeline
      ? this.pipelineBuilder.filterPipelineForTransaction(fullPipeline, id)
      : null;

    const token = collectJourneyTokens({
      approvals,
      transfers: transfers.map((t) => ({
        tokenSymbol: t.approval.tokenSymbol,
      })),
      collectionIntents,
      nativeTransfers,
      observabilityEvents,
    });

    return {
      transactionId: id,
      terminalStatus,
      startedAt,
      completedAt,
      walletAddress,
      network,
      token,
      timeline,
      observabilityEvents: observabilityEvents.map((e) => ({
        id: e.id,
        ts: e.ts.toISOString(),
        module: e.module,
        operation: e.operation,
        stage: e.stage,
        status: e.status,
        message: e.message,
        txHash: e.txHash,
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        publicId: a.publicId,
        network: a.network,
        tokenSymbol: a.tokenSymbol,
        status: a.status,
        txHash: a.txHash,
        traceId: a.traceId,
      })),
      collectionIntents: collectionIntents.map((c) => ({
        id: c.id,
        publicId: c.publicId,
        approvalId: c.approvalId,
        network: c.network,
        tokenSymbol: c.tokenSymbol,
        status: c.status,
        traceId: c.traceId,
      })),
      transfers: transfers.map((t) => ({
        id: t.id,
        publicId: t.publicId,
        network: t.approval.network,
        tokenSymbol: t.approval.tokenSymbol,
        status: t.status,
        txHash: t.txHash,
        traceId: t.approval.traceId,
        createdAt: t.createdAt.toISOString(),
      })),
      settlementSessions: settlementSessions.map((s) => ({
        id: s.id,
        publicId: s.publicId,
        clientSessionId: s.clientSessionId,
        network: s.network,
        status: s.status,
        traceId: s.traceId,
        nativeAuthKind: s.nativeAuthKind,
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
      tgEvents: tgEvents.map((t) => ({
        id: t.id,
        type: t.type,
        network: t.network,
        address: t.address,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        traceId: t.traceId,
      })),
      nativeTransfers: nativeTransfers.map((n) => ({
        id: n.id,
        publicId: n.publicId,
        network: n.network,
        txHash: n.txHash,
        status: n.status,
        traceId: n.traceId,
      })),
      txHashes,
      pipeline,
    };
  }
}
