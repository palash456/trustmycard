export {
  getErrorMessage,
  errorForLog,
} from "@trustmycard/shared/observability";
export type {
  SessionTimeline,
  LogEvent,
} from "@trustmycard/shared/observability";

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ObservabilityEventRow = {
  id: string;
  kind: string;
  ts: string;
  eventId: string;
  sessionId: string | null;
  traceId: string | null;
  correlationId: string | null;
  walletAddress: string | null;
  userId?: string | null;
  username?: string | null;
  userPublicId?: string | null;
  chain: string | null;
  network: string | null;
  module: string;
  operation: string;
  stage: string | null;
  status: string;
  level: string | null;
  txHash: string | null;
  token: string | null;
  asset: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  message: string;
  payload: unknown;
};

export type AuditLogRow = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
  createdAt: string;
};

export type ObservabilitySearchParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export type MetricsSnapshot = {
  counters: Record<string, number>;
  histograms: Record<
    string,
    { count: number; sum: number; p50?: number; p95?: number; p99?: number }
  >;
  gauges: Record<string, number>;
  capturedAt: string;
};
