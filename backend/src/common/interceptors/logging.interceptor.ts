import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import {
  recordTiming,
  safeObservability,
} from "@trustmycard/shared/observability";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { getRequestCorrelation } from "../middleware/correlation.middleware";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { correlationId, requestId } = getRequestCorrelation(req);
    const start = Date.now();
    const method = req.method;
    const path = req.url;

    safeObservability(() =>
      this.logger.emit({
        level: "info",
        module: "http",
        operation: "request",
        stage: "START",
        status: "started",
        message: `${method} ${path}`,
        correlationId,
        requestId,
        apiEndpoint: path,
        skipSampling: true,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          recordTiming("api.latency_ms", durationMs, {
            method,
            path,
            status: "success",
          });
          safeObservability(() =>
            this.logger.emit({
              level: "info",
              module: "http",
              operation: "request",
              stage: "COMPLETE",
              status: "success",
              message: `${method} ${path} completed`,
              correlationId,
              requestId,
              apiEndpoint: path,
              durationMs,
              skipSampling: true,
            }),
          );
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - start;
          recordTiming("api.latency_ms", durationMs, {
            method,
            path,
            status: "failure",
          });
          safeObservability(() =>
            this.logger.emit({
              level: "error",
              module: "http",
              operation: "request",
              stage: "FAILED",
              status: "failure",
              message: `${method} ${path} failed`,
              correlationId,
              requestId,
              apiEndpoint: path,
              durationMs,
              err,
              skipSampling: true,
            }),
          );
        },
      }),
    );
  }
}
