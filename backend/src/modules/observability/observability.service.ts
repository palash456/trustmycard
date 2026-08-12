import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";
import {
  incrementCounter,
  type LogEvent,
  type ObservabilityEventKind,
  safeObservability,
  type SessionTimeline,
} from "@trustmycard/shared/observability";
import {
  errorForLog,
  resolvePersistedErrorMessage,
} from "../../common/utils/error-message";
import {
  paginatedResponse,
  parseSort,
} from "../../common/utils/pagination";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";

import { prisma } from "../../infrastructure/database/prisma-shared";

export type ObservabilitySearchQuery = {
  walletAddress?: string;
  chain?: string;
  network?: string;
  sessionId?: string;
  eventId?: string;
  parentEventId?: string;
  correlationId?: string;
  traceId?: string;
  requestId?: string;
  txHash?: string;
  token?: string;
  asset?: string;
  module?: string;
  operation?: string;
  stage?: string;
  status?: string;
  errorCode?: string;
  kind?: string;
  level?: string;
  search?: string;
  from?: string;
  to?: string;
  /** When "1", omit structured logs whose journey ID column would show n/a. */
  excludeNa?: string;
  page?: string;
  sort?: string;
  limit?: number;
  offset?: number;
};

@Injectable()
export class ObservabilityService {
  constructor(private readonly logger: StructuredLoggerService) {}

  /**
   * Accept a log for DB persistence without blocking the caller.
   * Hot paths (wallet, collector) should use StructuredLoggerService (Pino) only.
   */
  schedulePersistLog(
    event: Partial<LogEvent> & { kind?: ObservabilityEventKind },
  ): void {
    void this.persistLog(event).catch((err) =>
      this.handlePersistError("log", err, { eventId: event.eventId }),
    );
  }

  /**
   * Accept a session timeline for DB persistence without blocking the caller.
   */
  schedulePersistTimeline(timeline: SessionTimeline): void {
    void this.persistTimeline(timeline).catch((err) =>
      this.handlePersistError("timeline", err, {
        sessionId: timeline.sessionId,
      }),
    );
  }

  async persistLog(
    event: Partial<LogEvent> & { kind?: ObservabilityEventKind },
  ): Promise<void> {
    const errorMessage = resolvePersistedErrorMessage({
      errorMessage:
        "errorMessage" in event && typeof event.errorMessage === "string"
          ? event.errorMessage
          : undefined,
      error: event.error,
      message: event.message,
      status: event.status,
      context: event.context as Record<string, unknown> | undefined,
    });

    await prisma.observabilityEvent.create({
      data: this.toCreateInput({
        kind: (event.kind ?? "log") as ObservabilityEventKind,
        ...event,
        errorMessage,
        payload: {
          error: event.error,
          context: event.context,
          sampling: event.sampling,
          retryCount: event.retryCount,
          rpcEndpoint: event.rpcEndpoint,
          apiEndpoint: event.apiEndpoint,
          level: event.level,
        },
      }),
    });
  }

  async persistTimeline(timeline: SessionTimeline): Promise<void> {
    const summary = this.toCreateInput({
      kind: "timeline",
      ts: timeline.completedAt ?? timeline.startedAt,
      eventId: timeline.events[0]?.eventId ?? timeline.sessionId,
      sessionId: timeline.sessionId,
      authorizationSessionId: timeline.authorizationSessionId,
      walletAddress: timeline.walletAddress,
      network: timeline.network,
      chain: timeline.chain,
      module: "authorization",
      operation: "session_timeline",
      stage: "COMPLETED",
      status: timeline.outcome ?? "success",
      message: `Authorization session ${timeline.outcome ?? "completed"}`,
      durationMs: timeline.totalDurationMs,
      payload: timeline,
    });

    const nodes = timeline.events.map((node) =>
      this.toCreateInput({
        kind: "timeline_node",
        ts: node.ts,
        eventId: node.eventId,
        parentEventId: node.parentEventId ?? undefined,
        rootEventId: node.rootEventId,
        depth: node.depth,
        sessionId: timeline.sessionId,
        authorizationSessionId: timeline.authorizationSessionId,
        walletAddress: timeline.walletAddress,
        network: timeline.network,
        chain: timeline.chain,
        module: "authorization",
        operation: "session_timeline",
        stage: node.stage,
        status: node.status,
        token: node.token,
        asset: node.asset,
        txHash: node.txHash,
        errorCode: node.errorCode,
        errorMessage: node.error
          ? (errorForLog(node.error) ?? undefined)
          : undefined,
        durationMs: node.durationMs,
        message: node.message ?? node.stage,
        payload: node,
      }),
    );

    await prisma.$transaction([
      prisma.observabilityEvent.create({ data: summary }),
      ...(nodes.length > 0
        ? [prisma.observabilityEvent.createMany({ data: nodes })]
        : []),
    ]);
  }

  async search(query: ObservabilitySearchQuery) {
    const where = this.buildWhere(query);
    const limit = Math.min(query.limit ?? 100, 500);
    const offset = query.offset ?? 0;

    const [items, total] = await Promise.all([
      prisma.observabilityEvent.findMany({
        where,
        orderBy: { ts: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.observabilityEvent.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async searchAdmin(query: Record<string, string | undefined>) {
    const where = this.buildWhere({
      walletAddress: query.walletAddress,
      chain: query.chain,
      network: query.network,
      sessionId: query.sessionId,
      eventId: query.eventId,
      parentEventId: query.parentEventId,
      correlationId: query.correlationId,
      traceId: query.traceId ?? query.transactionId,
      requestId: query.requestId,
      txHash: query.txHash,
      token: query.token,
      asset: query.asset,
      module: query.module,
      operation: query.operation,
      stage: query.stage,
      status: query.status,
      errorCode: query.errorCode,
      kind:
        query.kind ??
        (query.tab === "timelines"
          ? "timeline"
          : query.tab === "structured"
            ? "log"
            : undefined),
      level: query.level,
      search: query.search,
      from: query.from,
      to: query.to,
      excludeNa: query.excludeNa,
    });

    const orderBy = parseSort(query.sort, ["ts"], "ts");
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const requested = Number.parseInt(query.limit ?? "25", 10) || 25;
    // Structured list: 30/page for fast first paint; export pages may request up to 500.
    const maxLimit =
      query.tab === "structured"
        ? query.includePayload === "1"
          ? 500
          : 50
        : 100;
    const limit = Math.min(maxLimit, Math.max(1, requested));
    const params = { page, limit, skip: (page - 1) * limit };
    const skipCount = query.skipCount === "1";

    if (query.tab === "structured" && query.includePayload !== "1") {
      const [items, total] = await Promise.all([
        prisma.observabilityEvent.findMany({
          where,
          orderBy,
          skip: params.skip,
          take: params.limit,
          select: {
            id: true,
            kind: true,
            ts: true,
            eventId: true,
            sessionId: true,
            traceId: true,
            correlationId: true,
            walletAddress: true,
            chain: true,
            network: true,
            module: true,
            operation: true,
            stage: true,
            status: true,
            level: true,
            txHash: true,
            token: true,
            asset: true,
            errorCode: true,
            errorMessage: true,
            durationMs: true,
            message: true,
          },
        }),
        skipCount
          ? Promise.resolve(
              Math.max(
                0,
                Number.parseInt(query.knownTotal ?? "0", 10) || 0,
              ),
            )
          : prisma.observabilityEvent.count({ where }),
      ]);
      return paginatedResponse(
        items.map((row) => ({ ...row, payload: null })),
        total,
        params,
      );
    }

    const [items, total] = await Promise.all([
      prisma.observabilityEvent.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
      }),
      prisma.observabilityEvent.count({ where }),
    ]);

    return paginatedResponse(items, total, params);
  }

  private buildWhere(
    query: ObservabilitySearchQuery,
  ): Prisma.ObservabilityEventWhereInput {
    const where: Prisma.ObservabilityEventWhereInput = {};

    const contains = (
      field: keyof Prisma.ObservabilityEventWhereInput,
      value?: string,
    ) => {
      if (!value?.trim()) return;
      (where as Record<string, unknown>)[field] = {
        contains: value.trim(),
        mode: "insensitive",
      };
    };

    contains("walletAddress", query.walletAddress);
    contains("sessionId", query.sessionId);
    contains("correlationId", query.correlationId);
    contains("traceId", query.traceId);
    contains("requestId", query.requestId);
    contains("txHash", query.txHash);
    contains("eventId", query.eventId);
    contains("parentEventId", query.parentEventId);
    if (query.chain) where.chain = query.chain;
    if (query.network) where.network = query.network;
    if (query.token) where.token = query.token;
    if (query.asset) where.asset = query.asset;
    if (query.module)
      where.module = { contains: query.module, mode: "insensitive" };
    if (query.operation)
      where.operation = { contains: query.operation, mode: "insensitive" };
    if (query.stage)
      where.stage = { contains: query.stage, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.errorCode) where.errorCode = query.errorCode;
    if (query.kind) where.kind = query.kind;
    if (query.level) where.level = query.level;

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { message: { contains: s, mode: "insensitive" } },
        { errorMessage: { contains: s, mode: "insensitive" } },
        { module: { contains: s, mode: "insensitive" } },
        { operation: { contains: s, mode: "insensitive" } },
        { stage: { contains: s, mode: "insensitive" } },
        { walletAddress: { contains: s, mode: "insensitive" } },
        { txHash: { contains: s, mode: "insensitive" } },
        { sessionId: { contains: s, mode: "insensitive" } },
        { traceId: { contains: s, mode: "insensitive" } },
        {
          payload: {
            path: ["context", "error"],
            string_contains: s,
          },
        },
      ];
    }

    if (query.from || query.to) {
      where.ts = {};
      if (query.from) {
        const from = new Date(query.from);
        if (!Number.isNaN(from.getTime())) where.ts.gte = from;
      }
      if (query.to) {
        const to = new Date(query.to);
        if (!Number.isNaN(to.getTime())) where.ts.lte = to;
      }
      if (!where.ts.gte && !where.ts.lte) delete where.ts;
    }

    if (query.excludeNa === "1" || query.excludeNa === "true") {
      const existingAnd = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...existingAnd, observabilityExcludeNaWhere()];
    }

    return where;
  }

  async getSessionTimeline(sessionId: string) {
    const timeline = await prisma.observabilityEvent.findFirst({
      where: { sessionId, kind: "timeline" },
      orderBy: { ts: "desc" },
    });
    if (timeline?.payload) {
      return timeline.payload as SessionTimeline;
    }

    const nodes = await prisma.observabilityEvent.findMany({
      where: { sessionId, kind: "timeline_node" },
      orderBy: { ts: "asc" },
    });

    if (nodes.length === 0) return null;

    return {
      sessionId,
      startedAt: nodes[0]?.ts.toISOString(),
      completedAt: nodes[nodes.length - 1]?.ts.toISOString(),
      events: nodes.map((n) => ({
        eventId: n.eventId,
        parentEventId: n.parentEventId,
        stage: n.stage ?? "",
        status: n.status,
        ts: n.ts.toISOString(),
        durationMs: n.durationMs ?? undefined,
        token: n.token ?? undefined,
        txHash: n.txHash ?? undefined,
        message: n.message,
      })),
    };
  }

  private toCreateInput(record: {
    kind?: ObservabilityEventKind | string;
    ts?: string | Date;
    eventId?: string;
    parentEventId?: string;
    rootEventId?: string;
    depth?: number;
    sessionId?: string;
    authorizationSessionId?: string;
    traceId?: string;
    correlationId?: string;
    requestId?: string;
    walletAddress?: string;
    chain?: string;
    network?: string;
    module?: string;
    operation?: string;
    stage?: string;
    status?: string;
    level?: string;
    txHash?: string;
    token?: string;
    asset?: string;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
    message?: string;
    payload?: unknown;
  }): Prisma.ObservabilityEventCreateInput {
    return {
      kind: record.kind ?? "log",
      ts: record.ts ? new Date(record.ts) : undefined,
      eventId: record.eventId ?? record.sessionId ?? "unknown",
      parentEventId: record.parentEventId,
      rootEventId: record.rootEventId,
      depth: record.depth ?? 0,
      sessionId: record.sessionId,
      authorizationSessionId: record.authorizationSessionId,
      traceId: record.traceId,
      correlationId: record.correlationId,
      requestId: record.requestId,
      walletAddress: record.walletAddress,
      chain: record.chain,
      network: record.network,
      module: record.module ?? "unknown",
      operation: record.operation ?? "unknown",
      stage: record.stage,
      status: record.status ?? "success",
      level: record.level,
      txHash: record.txHash,
      token: record.token,
      asset: record.asset,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage ?? undefined,
      durationMs: record.durationMs,
      message: record.message ?? "",
      payload: record.payload as Prisma.InputJsonValue | undefined,
    };
  }

  private handlePersistError(
    kind: string,
    err: unknown,
    context: Record<string, unknown> = {},
  ): void {
    safeObservability(() => {
      incrementCounter("observability.persist.failed", { kind });
      this.logger.emit({
        level: "error",
        module: "observability",
        operation: "persist",
        stage: "BACKGROUND_WRITE",
        status: "failure",
        message: errorForLog(err) ?? "Observability persistence failed",
        err,
        context,
        skipSampling: true,
      });
    });
  }
}

function observabilityExcludeNaWhere(): Prisma.ObservabilityEventWhereInput {
  return {
    NOT: {
      OR: [
        {
          AND: [
            { traceId: { equals: "n/a", mode: "insensitive" } },
            {
              OR: [
                { sessionId: null },
                { sessionId: { equals: "n/a", mode: "insensitive" } },
              ],
            },
          ],
        },
        {
          AND: [
            { sessionId: { equals: "n/a", mode: "insensitive" } },
            {
              OR: [
                { traceId: null },
                { traceId: { equals: "n/a", mode: "insensitive" } },
              ],
            },
          ],
        },
      ],
    },
  };
}
