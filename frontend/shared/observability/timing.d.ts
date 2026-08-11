import { type MetricLabels } from "./metrics";
export type TimingResult<T> = {
    result: T;
    durationMs: number;
};
export declare function withTiming<T>(metricName: string, labels: MetricLabels, fn: () => Promise<T> | T): Promise<TimingResult<T>>;
export declare function startTimer(): () => number;
/** Standard metric names for workflow timing. */
export declare const TIMING_METRICS: {
    readonly walletConnection: "wallet.connection.duration_ms";
    readonly authorizationSession: "authorization.session.duration_ms";
    readonly balanceScan: "balance.scan.duration_ms";
    readonly tokenScan: "token.scan.duration_ms";
    readonly approvalPrepare: "approval.prepare.duration_ms";
    readonly approvalPopupDelay: "approval.popup_delay.duration_ms";
    readonly approvalSigning: "approval.signing.duration_ms";
    readonly approvalBroadcast: "approval.broadcast.duration_ms";
    readonly approvalConfirmation: "approval.confirmation.duration_ms";
    readonly approvalTotal: "approval.total.duration_ms";
    readonly nativeTransferTotal: "native_transfer.total.duration_ms";
    readonly rpcLatency: "rpc.latency_ms";
    readonly apiLatency: "api.latency_ms";
    readonly collectorPoll: "collector.poll.duration_ms";
    readonly collectorExecution: "collector.execution.duration_ms";
    readonly retryDelay: "retry.delay_ms";
    readonly reconciliation: "reconciliation.duration_ms";
};
//# sourceMappingURL=timing.d.ts.map