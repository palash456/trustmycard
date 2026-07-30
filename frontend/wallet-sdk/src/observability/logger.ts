import {
  compactLogDetail,
  createEventId,
  getErrorCode,
  getErrorMessage,
  incrementCounter,
  LogSampler,
  recordTiming,
  redactContext,
  safeObservability,
  serializeError,
  type EventContext,
  type LogEvent,
  type LogLevel,
  type LogStatus,
} from "@trustmycard/shared/observability";

export type LoggerSink = (event: LogEvent) => void;

export type CreateLoggerOptions = {
  module: string;
  context?: Partial<EventContext>;
  sinks?: LoggerSink[];
  sampler?: LogSampler;
  devMode?: boolean;
};

async function postClientLog(event: LogEvent): Promise<void> {
  try {
    const backend =
      typeof process !== "undefined" && process.env.BACKEND_URL
        ? process.env.BACKEND_URL
        : "";
    const url = backend
      ? `${backend.replace(/\/$/, "")}/v1/client-logs`
      : "/api/client-logs";
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "log", events: [event] }),
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* soft-fail */
  }
}

function consoleSink(event: LogEvent): void {
  try {
    const line = `[${event.module}] ${event.operation}/${event.stage ?? "-"} ${event.status}: ${event.message}`;
    const payload = compactLogDetail(redactContext(event) as Record<string, unknown>);
    switch (event.level) {
      case "error":
      case "fatal":
        console.error(line, payload);
        break;
      case "warn":
        console.warn(line, payload);
        break;
      case "debug":
      case "trace":
        console.debug(line, payload);
        break;
      default:
        console.info(line, payload);
    }
  } catch {
    /* fail-open */
  }
}

export type ObservabilityLogger = {
  emit: (input: Omit<Partial<LogEvent>, "module" | "ts" | "eventId"> & {
    level: LogLevel;
    operation: string;
    status: LogStatus;
    message: string;
    err?: unknown;
    skipSampling?: boolean;
  }) => void;
  child: (bindings: Partial<EventContext>) => ObservabilityLogger;
  getContext: () => Partial<EventContext>;
};

export function createLogger(options: CreateLoggerOptions): ObservabilityLogger {
  const isDev =
    options.devMode ??
    (typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : true);
  const sampler = options.sampler ?? new LogSampler({ enabled: !isDev });
  const sinks: LoggerSink[] = options.sinks ?? [
    ...(isDev ? [consoleSink] : []),
    (event) => void postClientLog(event),
  ];

  let context: Partial<EventContext> = {
    ...options.context,
  };

  const build = (ctx: Partial<EventContext>): ObservabilityLogger => ({
    getContext: () => ({ ...ctx }),
    child: (bindings) => {
      context = { ...ctx, ...bindings };
      return build(context);
    },
    emit: (input) => {
      safeObservability(() => {
        const eventId = input.eventId ?? createEventId();
        const error =
          input.error ?? (input.err !== undefined ? serializeError(input.err) : undefined);
        const event: LogEvent = {
          ts: new Date().toISOString(),
          module: options.module,
          eventId,
          parentEventId: input.parentEventId ?? ctx.parentEventId,
          rootEventId: input.rootEventId ?? ctx.rootEventId ?? ctx.eventId,
          depth: input.depth ?? ctx.depth,
          sessionId: input.sessionId ?? ctx.sessionId,
          authorizationSessionId:
            input.authorizationSessionId ?? ctx.authorizationSessionId,
          traceId: input.traceId ?? ctx.traceId,
          correlationId: input.correlationId ?? ctx.correlationId,
          requestId: input.requestId ?? ctx.requestId,
          walletAddress: input.walletAddress ?? ctx.walletAddress,
          chain: input.chain ?? ctx.chain,
          network: input.network ?? ctx.network,
          level: input.level,
          operation: input.operation,
          stage: input.stage,
          status: input.status,
          message: input.message,
          token: input.token,
          asset: input.asset,
          txHash: input.txHash,
          durationMs: input.durationMs,
          retryCount: input.retryCount,
          rpcEndpoint: input.rpcEndpoint,
          apiEndpoint: input.apiEndpoint,
          error,
          errorCode: input.errorCode ?? (error ? getErrorCode(error) ?? undefined : undefined),
          context: input.context as Record<string, unknown> | undefined,
          sampling: input.sampling,
        };

        if (
          !input.skipSampling &&
          input.level !== "error" &&
          input.level !== "fatal"
        ) {
          const decision = sampler.shouldEmit(input.level, options.module, {
            operation: input.operation,
            stage: input.stage,
            status: input.status,
            errorCode: event.errorCode,
            message: input.message,
          });
          if (!decision.emit) {
            incrementCounter("logs.sampled.suppressed", {
              module: options.module,
              operation: input.operation,
              level: input.level,
            });
            return;
          }
          if (decision.info) event.sampling = decision.info;
        }

        if (event.durationMs != null) {
          recordTiming(`${options.module}.${input.operation}.duration_ms`, event.durationMs, {
            status: input.status,
            network: event.network ?? "unknown",
          });
        }

        for (const sink of sinks) {
          try {
            sink(event);
          } catch {
            /* fail-open per sink */
          }
        }
      });
    },
  });

  return build(context);
}

export { getErrorMessage, serializeError, getErrorCode };
