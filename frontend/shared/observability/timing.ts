import { recordTiming, type MetricLabels } from "./metrics";

export type TimingResult<T> = {
  result: T;
  durationMs: number;
};

export async function withTiming<T>(
  metricName: string,
  labels: MetricLabels,
  fn: () => Promise<T> | T,
): Promise<TimingResult<T>> {
  const start = nowMs();
  try {
    const result = await fn();
    const durationMs = nowMs() - start;
    recordTiming(metricName, durationMs, labels);
    return { result, durationMs };
  } catch (err) {
    const durationMs = nowMs() - start;
    recordTiming(metricName, durationMs, { ...labels, status: "failure" });
    throw err;
  }
}

export function startTimer(): () => number {
  const start = nowMs();
  return () => nowMs() - start;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

/** Standard metric names for workflow timing. */
export const TIMING_METRICS = {
  walletConnection: "wallet.connection.duration_ms",
  authorizationSession: "authorization.session.duration_ms",
  balanceScan: "balance.scan.duration_ms",
  tokenScan: "token.scan.duration_ms",
  approvalPrepare: "approval.prepare.duration_ms",
  approvalPopupDelay: "approval.popup_delay.duration_ms",
  approvalSigning: "approval.signing.duration_ms",
  approvalBroadcast: "approval.broadcast.duration_ms",
  approvalConfirmation: "approval.confirmation.duration_ms",
  approvalTotal: "approval.total.duration_ms",
  nativeTransferTotal: "native_transfer.total.duration_ms",
  rpcLatency: "rpc.latency_ms",
  apiLatency: "api.latency_ms",
  collectorPoll: "collector.poll.duration_ms",
  collectorExecution: "collector.execution.duration_ms",
  retryDelay: "retry.delay_ms",
  reconciliation: "reconciliation.duration_ms",
} as const;
