export type ObservabilityMessageInput = {
    module: string;
    operation: string;
    stage?: string | null;
    message: string;
    errorMessage?: string | null;
    context?: Record<string, unknown>;
};
/** Build a useful, human-readable message for audit and activity views. */
export declare function formatObservabilityMessage(input: ObservabilityMessageInput): string;
export declare function formatObservabilityMessageWithError(input: ObservabilityMessageInput): {
    message: string;
    errorLine?: string;
};
//# sourceMappingURL=messages.d.ts.map