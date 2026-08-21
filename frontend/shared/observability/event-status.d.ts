import type { LogStatus } from "./schemas";
export type ObservabilityDisplayStatus = "completed" | "in_progress" | "failed" | "cancelled" | "revoked";
/** Resolve persisted log status for connect-flow steps at emission time. */
export declare function resolveConnectStepLogStatus(step: string, detail?: Record<string, unknown>): LogStatus;
/** Resolve persisted log status for approval-module events at emission time. */
export declare function resolveApprovalEventLogStatus(event: string, level: "info" | "warn" | "error", detail?: Record<string, unknown>): LogStatus;
/** Map stored log status + event metadata to admin-friendly display status. */
export declare function resolveObservabilityDisplayStatus(input: {
    status: string;
    stage?: string | null;
    operation?: string | null;
    module?: string | null;
    level?: string | null;
    context?: Record<string, unknown>;
}): ObservabilityDisplayStatus;
export declare function formatObservabilityModulePath(module: string, operation: string): string;
/** Map transaction journey terminal status to admin display status. */
export declare function resolveTransactionDisplayStatus(input: {
    terminalStatus: string;
    settlementStatus?: string | null;
    latestStage?: string | null;
}): {
    status: ObservabilityDisplayStatus;
    label: string;
};
//# sourceMappingURL=event-status.d.ts.map