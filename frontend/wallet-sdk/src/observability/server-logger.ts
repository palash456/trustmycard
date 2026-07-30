import { createLogger, type ObservabilityLogger } from "./logger";

let serverLogger: ObservabilityLogger | null = null;

export function getServerLogger(module = "wallet-sdk-server"): ObservabilityLogger {
  if (!serverLogger) {
    serverLogger = createLogger({
      module,
      devMode: process.env.NODE_ENV !== "production",
    });
  }
  return serverLogger;
}

export function logServerError(
  module: string,
  operation: string,
  err: unknown,
  partial: Record<string, unknown> = {}
): void {
  getServerLogger(module).emit({
    level: "error",
    operation,
    stage: "FAILED",
    status: "failure",
    message: partial.message as string ?? `${operation} failed`,
    err,
    skipSampling: true,
    ...partial,
  });
}
