export type SerializedError = {
    message: string;
    name?: string;
    code?: string | number;
    status?: number;
    stack?: string;
    cause?: SerializedError;
    responseBody?: unknown;
};
/** Normalize API / wallet errors into a readable string. */
export declare function getErrorMessage(err: unknown, fallback?: string): string;
/** Full structured error for logs — never produces "[object Object]". */
export declare function serializeError(err: unknown): SerializedError;
/** Prefer underlying cause when wallets/browsers surface generic fetch errors. */
export declare function enrichErrorMessage(err: unknown, fallback?: string): string;
/** Resolve the best error string for DB persistence from a log event shape. */
export declare function resolvePersistedErrorMessage(event: {
    errorMessage?: string;
    error?: unknown;
    message?: string;
    status?: string;
    context?: Record<string, unknown>;
}): string | undefined;
/** Nullable string for persisted log columns. */
export declare function errorForLog(value: unknown): string | null;
/** Extract error code from unknown error shapes. */
export declare function getErrorCode(err: unknown): string | null;
/** True when the user closed/rejected the wallet permission prompt. */
export declare function isUserRejection(err: unknown): boolean;
//# sourceMappingURL=errors.d.ts.map