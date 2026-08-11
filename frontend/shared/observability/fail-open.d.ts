/**
 * Observability must be fail-open: logging/metrics failures never affect
 * wallet, collector, or API primary flows.
 */
/** Run sync observability work; swallow any thrown error. */
export declare function safeObservability(fn: () => void): void;
/** Run async observability work; swallow rejections. */
export declare function safeObservabilityAsync(fn: () => Promise<void>): void;
//# sourceMappingURL=fail-open.d.ts.map