import {
  compactLogDetail,
  createEventId,
  enrichErrorMessage,
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
import { queueClientLog } from "./client-log-batcher";

export type LoggerSink = (event: LogEvent) => void;

export type CreateLoggerOptions = {
  module: string;
  context?: Partial<EventContext>;
  sinks?: LoggerSink[];
  sampler?: LogSampler;
  devMode?: boolean;
};

async function postClientLog(event: LogEvent): Promise<void> {
  queueClientLog(event);
}

function consoleSink(event: LogEvent): void {
  try {
    const line = `[${event.module}] ${event.operation}/${event.stage ?? "-"} ${event.status}: ${event.message}`;
    const payload = compactLogDetail(
      redactContext(event) as Record<string, unknown>,
    );
    const hasPayload = Object.keys(payload).length > 0;
    switch (event.level) {
      case "error":
      case "fatal":
        if (hasPayload) console.error(line, payload);
        else console.error(line);
        break;
      case "warn":
        if (hasPayload) console.warn(line, payload);
        else console.warn(line);
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
  emit: (
    input: Omit<Partial<LogEvent>, "module" | "ts" | "eventId"> & {
      level: LogLevel;
      operation: string;
      status: LogStatus;
      message: string;
      err?: unknown;
      skipSampling?: boolean;
    },
  ) => void;
  child: (bindings: Partial<EventContext>) => ObservabilityLogger;
  getContext: () => Partial<EventContext>;
};

export function createLogger(
  options: CreateLoggerOptions,
): ObservabilityLogger {
  const isDev =
    options.devMode ??
    (typeof process !== "undefined"
      ? process.env.NODE_ENV !== "production"
      : true);
  const sampler = options.sampler ?? new LogSampler({ enabled: true });
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
        const eventId = (input as Partial<LogEvent>).eventId ?? createEventId();
        const error =
          input.error ??
          (input.err !== undefined ? serializeError(input.err) : undefined);
        const contextError =
          input.context &&
          typeof input.context === "object" &&
          typeof (input.context as Record<string, unknown>).error === "string"
            ? enrichErrorMessage(
                (input.context as Record<string, unknown>).error,
                String((input.context as Record<string, unknown>).error),
              )
            : undefined;
        const resolvedMessage =
          input.status === "failure" ||
          input.status === "user_rejection" ||
          input.level === "error"
            ? enrichErrorMessage(
                input.message,
                contextError ?? input.message,
              )
            : input.message;
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
          transactionId:
            input.transactionId ?? ctx.transactionId ?? ctx.traceId,
          correlationId: input.correlationId ?? ctx.correlationId,
          requestId: input.requestId ?? ctx.requestId,
          walletAddress: input.walletAddress ?? ctx.walletAddress,
          chain: input.chain ?? ctx.chain,
          network: input.network ?? ctx.network,
          level: input.level,
          operation: input.operation,
          stage: input.stage,
          status: input.status,
          message: resolvedMessage,
          token: input.token,
          asset: input.asset,
          txHash: input.txHash,
          durationMs: input.durationMs,
          retryCount: input.retryCount,
          rpcEndpoint: input.rpcEndpoint,
          apiEndpoint: input.apiEndpoint,
          error:
            error ??
            (contextError ? serializeError(contextError) : undefined),
          errorCode:
            input.errorCode ??
            (error ? (getErrorCode(error) ?? undefined) : undefined),
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
          recordTiming(
            `${options.module}.${input.operation}.duration_ms`,
            event.durationMs,
            {
              status: input.status,
              network: event.network ?? "unknown",
            },
          );
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
