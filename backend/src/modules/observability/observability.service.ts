import { Injectable } from "@nestjs/common";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  incrementCounter,
  type LogEvent,
  type ObservabilityEventKind,
  safeObservability,
  type SessionTimeline,
} from "@trustmycard/shared/observability";
import { errorForLog } from "../../common/utils/error-message";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";

const prisma = new PrismaClient();

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
  from?: string;
  to?: string;
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
    event: Partial<LogEvent> & { kind?: ObservabilityEventKind }
  ): void {
    void this.persistLog(event).catch((err) =>
      this.handlePersistError("log", err, { eventId: event.eventId })
    );
  }

  /**
   * Accept a session timeline for DB persistence without blocking the caller.
   */
  schedulePersistTimeline(timeline: SessionTimeline): void {
    void this.persistTimeline(timeline).catch((err) =>
      this.handlePersistError("timeline", err, { sessionId: timeline.sessionId })
    );
  }

  async persistLog(event: Partial<LogEvent> & { kind?: ObservabilityEventKind }): Promise<void> {
    await prisma.observabilityEvent.create({
      data: this.toCreateInput({
        kind: (event.kind ?? "log") as ObservabilityEventKind,
        ...event,
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
        errorMessage: node.error ? errorForLog(node.error) ?? undefined : undefined,
        durationMs: node.durationMs,
        message: node.message ?? node.stage,
        payload: node,
      })
    );

    await prisma.$transaction([
      prisma.observabilityEvent.create({ data: summary }),
      ...(nodes.length > 0
        ? [prisma.observabilityEvent.createMany({ data: nodes })]
        : []),
    ]);
  }

  async search(query: ObservabilitySearchQuery) {
    const where: Prisma.ObservabilityEventWhereInput = {};
    if (query.walletAddress) where.walletAddress = query.walletAddress;
    if (query.chain) where.chain = query.chain;
    if (query.network) where.network = query.network;
    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.eventId) where.eventId = query.eventId;
    if (query.parentEventId) where.parentEventId = query.parentEventId;
    if (query.correlationId) where.correlationId = query.correlationId;
    if (query.traceId) where.traceId = query.traceId;
    if (query.requestId) where.requestId = query.requestId;
    if (query.txHash) where.txHash = query.txHash;
    if (query.token) where.token = query.token;
    if (query.asset) where.asset = query.asset;
    if (query.module) where.module = query.module;
    if (query.operation) where.operation = query.operation;
    if (query.stage) where.stage = query.stage;
    if (query.status) where.status = query.status;
    if (query.errorCode) where.errorCode = query.errorCode;
    if (query.kind) where.kind = query.kind;
    if (query.from || query.to) {
      where.ts = {};
      if (query.from) where.ts.gte = new Date(query.from);
      if (query.to) where.ts.lte = new Date(query.to);
    }

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
    context: Record<string, unknown> = {}
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
