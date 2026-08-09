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
export declare function getErrorMessage(
  err: unknown,
  fallback?: string,
): string;
/** Full structured error for logs — never produces "[object Object]". */
export declare function serializeError(err: unknown): SerializedError;
/** Nullable string for persisted log columns. */
export declare function errorForLog(value: unknown): string | null;
/** Extract error code from unknown error shapes. */
export declare function getErrorCode(err: unknown): string | null;
/** True when the user closed/rejected the wallet permission prompt. */
export declare function isUserRejection(err: unknown): boolean;
//# sourceMappingURL=errors.d.ts.map
