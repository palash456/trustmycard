import type { SerializedError } from "./errors";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogStatus =
  | "started"
  | "in_progress"
  | "success"
  | "failure"
  | "skipped"
  | "retry"
  | "timeout"
  | "user_rejection"
  | "validation_failure"
  | "network_failure"
  | "rpc_failure"
  | "api_failure"
  | "partial_success";

export type SamplingInfo = {
  totalOccurrences: number;
  suppressedCount: number;
  firstOccurrenceAt: string;
  latestOccurrenceAt: string;
  samplingKey?: string;
};

export type LogEvent = {
  ts: string;
  level: LogLevel;
  module: string;
  operation: string;
  stage?: string;
  status: LogStatus;
  message: string;
  eventId: string;
  parentEventId?: string;
  rootEventId?: string;
  depth?: number;
  sessionId?: string;
  authorizationSessionId?: string;
  traceId?: string;
  /** Alias for traceId — one opaque ID per user transaction attempt. */
  transactionId?: string;
  correlationId?: string;
  requestId?: string;
  walletAddress?: string;
  chain?: string;
  network?: string;
  token?: string;
  asset?: string;
  txHash?: string;
  durationMs?: number;
  retryCount?: number;
  rpcEndpoint?: string;
  apiEndpoint?: string;
  error?: SerializedError;
  errorCode?: string;
  sampling?: SamplingInfo;
  context?: Record<string, unknown>;
};

export type TimelineEvent = {
  eventId: string;
  parentEventId?: string | null;
  rootEventId?: string;
  depth?: number;
  stage: string;
  status: LogStatus;
  ts: string;
  message?: string;
  durationMs?: number;
  token?: string;
  asset?: string;
  txHash?: string;
  error?: SerializedError;
  errorCode?: string;
  context?: Record<string, unknown>;
};

export type SessionTimeline = {
  sessionId: string;
  authorizationSessionId?: string;
  walletAddress?: string;
  network?: string;
  chain?: string;
  startedAt: string;
  completedAt?: string;
  outcome?: LogStatus;
  totalDurationMs?: number;
  events: TimelineEvent[];
};

export type ObservabilityEventKind = "log" | "timeline" | "timeline_node";

export type ObservabilityEventRecord = {
  kind: ObservabilityEventKind;
  ts: string;
  eventId: string;
  parentEventId?: string;
  rootEventId?: string;
  depth?: number;
  sessionId?: string;
  authorizationSessionId?: string;
  traceId?: string;
  /** Alias for traceId — one opaque ID per user transaction attempt. */
  transactionId?: string;
  correlationId?: string;
  requestId?: string;
  walletAddress?: string;
  chain?: string;
  network?: string;
  module: string;
  operation: string;
  stage?: string;
  status: LogStatus;
  level?: LogLevel;
  txHash?: string;
  token?: string;
  asset?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  message: string;
  payload?: Record<string, unknown>;
};
