import { Injectable, LoggerService } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import {
  compactLogDetail,
  createEventId,
  incrementCounter,
  redactContext,
  safeObservability,
  serializeError,
  type LogEvent,
  type LogLevel,
  type LogStatus,
} from "@trustmycard/shared/observability";
import { LogSamplerService } from "./log-sampler.service";

export type StructuredLogInput = Partial<Omit<LogEvent, "ts">> & {
  level: LogLevel;
  module: string;
  operation: string;
  status: LogStatus;
  message: string;
  err?: unknown;
  skipSampling?: boolean;
};

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(
    private readonly pino: PinoLogger,
    private readonly sampler: LogSamplerService
  ) {}

  log(message: unknown, context?: string) {
    this.info(String(message), { module: context ?? "app", operation: "log", status: "success" });
  }

  error(message: unknown, trace?: string, context?: string) {
    this.emit({
      level: "error",
      module: context ?? "app",
      operation: "error",
      status: "failure",
      message: String(message),
      err: trace,
      skipSampling: true,
    });
  }

  warn(message: unknown, context?: string) {
    this.emit({
      level: "warn",
      module: context ?? "app",
      operation: "warn",
      status: "in_progress",
      message: String(message),
    });
  }

  debug(message: unknown, context?: string) {
    this.emit({
      level: "debug",
      module: context ?? "app",
      operation: "debug",
      status: "in_progress",
      message: String(message),
    });
  }

  verbose(message: unknown, context?: string) {
    this.trace(String(message), { module: context ?? "app", operation: "verbose", status: "in_progress" });
  }

  info(message: string, partial: Partial<StructuredLogInput> = {}) {
    this.emit({ level: "info", message, status: "success", operation: "info", module: "app", ...partial });
  }

  trace(message: string, partial: Partial<StructuredLogInput> = {}) {
    this.emit({ level: "trace", message, status: "in_progress", operation: "trace", module: "app", ...partial });
  }

  fatal(message: string, partial: Partial<StructuredLogInput> = {}) {
    this.emit({
      level: "fatal",
      message,
      status: "failure",
      operation: "fatal",
      module: "app",
      skipSampling: true,
      ...partial,
    });
  }

  /** Fail-open: never throws into caller (wallet, collector, HTTP handlers). */
  emit(input: StructuredLogInput): void {
    safeObservability(() => this.emitUnsafe(input));
  }

  private emitUnsafe(input: StructuredLogInput): void {
    const eventId = input.eventId ?? createEventId();
    const error = input.error ?? (input.err !== undefined ? serializeError(input.err) : undefined);
    const payload = compactLogDetail(
      redactContext({
        ts: new Date().toISOString(),
        eventId,
        error,
        errorCode: input.errorCode ?? (error?.code != null ? String(error.code) : undefined),
        ...input,
        context: input.context ? redactContext(input.context) as Record<string, unknown> : undefined,
      }) as Record<string, unknown>
    );

    if (!input.skipSampling && input.level !== "error" && input.level !== "fatal") {
      const decision = this.sampler.shouldEmit(input.level, input.module, {
        operation: input.operation,
        stage: input.stage,
        status: input.status,
        errorCode: payload.errorCode,
        message: input.message,
      });
      if (!decision.emit) {
        incrementCounter("logs.sampled.suppressed", {
          module: input.module,
          operation: input.operation,
          level: input.level,
        });
        return;
      }
      if (decision.info) {
        payload.sampling = decision.info;
      }
    }

    const logger = this.pino.logger.child({ module: input.module });
    switch (input.level) {
      case "fatal":
        logger.fatal(payload);
        break;
      case "error":
        logger.error(payload);
        break;
      case "warn":
        logger.warn(payload);
        break;
      case "debug":
        logger.debug(payload);
        break;
      case "trace":
        logger.trace(payload);
        break;
      default:
        logger.info(payload);
    }
  }

  child(bindings: Record<string, unknown>): StructuredLoggerService {
    const childPino = this.pino.logger.child(bindings);
    const child = new StructuredLoggerService(
      { logger: childPino } as PinoLogger,
      this.sampler
    );
    return child;
  }
}
