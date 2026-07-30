import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined)?.trim() ||
      randomUUID();
    const requestId = randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    (req as Request & { correlationId?: string; requestId?: string }).correlationId =
      correlationId;
    (req as Request & { correlationId?: string; requestId?: string }).requestId =
      requestId;

    next();
  }
}

export function getRequestCorrelation(req: Request): {
  correlationId?: string;
  requestId?: string;
} {
  const extended = req as Request & { correlationId?: string; requestId?: string };
  return {
    correlationId: extended.correlationId,
    requestId: extended.requestId,
  };
}
