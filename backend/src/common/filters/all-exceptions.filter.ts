import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { getErrorMessage, safeObservability, serializeError } from "@trustmycard/shared/observability";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { getRequestCorrelation } from "../middleware/correlation.middleware";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { correlationId, requestId } = getRequestCorrelation(req);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const message =
      typeof responseBody === "string"
        ? responseBody
        : responseBody && typeof responseBody === "object" && "message" in responseBody
          ? getErrorMessage((responseBody as { message: unknown }).message, getErrorMessage(exception))
          : getErrorMessage(exception);

    safeObservability(() =>
      this.logger.emit({
        level: status >= 500 ? "error" : "warn",
        module: "http",
        operation: "exception",
        stage: "UNHANDLED",
        status: status >= 500 ? "failure" : "validation_failure",
        message,
        correlationId,
        requestId,
        apiEndpoint: req.url,
        err: exception,
        error: serializeError(exception),
        skipSampling: true,
      })
    );

    res.status(status).json({
      statusCode: status,
      message,
      correlationId,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
