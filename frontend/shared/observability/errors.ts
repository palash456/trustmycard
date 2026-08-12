const OBJECT_COERCED = "[object Object]";

export type SerializedError = {
  message: string;
  name?: string;
  code?: string | number;
  status?: number;
  stack?: string;
  cause?: SerializedError;
  responseBody?: unknown;
};

function messageFromObject(value: Record<string, unknown>): string | null {
  if (typeof value.message === "string" && value.message) return value.message;
  if (Array.isArray(value.message) && value.message.length > 0) {
    return value.message.map((part) => String(part)).join("; ");
  }
  if (typeof value.reason === "string" && value.reason) return value.reason;
  if (typeof value.error === "string" && value.error) return value.error;
  if (value.error && typeof value.error === "object") {
    const nested = getErrorMessage(value.error, "");
    return nested || null;
  }
  return null;
}

function serializeUnknown(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized === "{}" || serialized === "[]") return null;
    return serialized.length > 500
      ? `${serialized.slice(0, 497)}...`
      : serialized;
  } catch {
    return null;
  }
}

/** Normalize API / wallet errors into a readable string. */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (typeof err === "string" && err) return err;
  if (err instanceof Error) {
    if (err.message && err.message !== OBJECT_COERCED) return err.message;
  }
  if (err && typeof err === "object") {
    const extracted = messageFromObject(err as Record<string, unknown>);
    if (extracted) return extracted;
    const serialized = serializeUnknown(err);
    if (serialized) return serialized;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Full structured error for logs — never produces "[object Object]". */
export function serializeError(err: unknown): SerializedError {
  if (typeof err === "string") {
    return { message: err || "Unknown error" };
  }

  if (err instanceof Error) {
    const e = err as Error & {
      code?: string | number;
      status?: number;
      statusCode?: number;
      response?: { data?: unknown; status?: number };
      cause?: unknown;
    };
    const message =
      e.message && e.message !== OBJECT_COERCED
        ? e.message
        : getErrorMessage(err, "Unknown error");
    const serialized: SerializedError = {
      message,
      name: e.name || undefined,
      code: e.code,
      status: e.status ?? e.statusCode ?? e.response?.status,
      stack: e.stack,
    };
    if (e.response?.data !== undefined) {
      serialized.responseBody = truncateValue(e.response.data, 500);
    }
    if (e.cause !== undefined) {
      serialized.cause = serializeError(e.cause);
    }
    return serialized;
  }

  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const message = getErrorMessage(err, "Unknown error");
    const serialized: SerializedError = {
      message,
      name: typeof obj.name === "string" ? obj.name : undefined,
      code:
        typeof obj.code === "string" || typeof obj.code === "number"
          ? obj.code
          : undefined,
      status:
        typeof obj.status === "number"
          ? obj.status
          : typeof obj.statusCode === "number"
            ? obj.statusCode
            : undefined,
    };
    if (obj.stack && typeof obj.stack === "string") {
      serialized.stack = obj.stack;
    }
    if (obj.responseBody !== undefined) {
      serialized.responseBody = truncateValue(obj.responseBody, 500);
    } else if (obj.response && typeof obj.response === "object") {
      const resp = obj.response as { data?: unknown };
      if (resp.data !== undefined) {
        serialized.responseBody = truncateValue(resp.data, 500);
      }
    }
    if (obj.cause !== undefined) {
      serialized.cause = serializeError(obj.cause);
    }
    return serialized;
  }

  return { message: getErrorMessage(err) };
}

function truncateValue(value: unknown, maxLen: number): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return value;
    return `${s.slice(0, maxLen - 3)}...`;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

const GENERIC_CLIENT_ERROR_MESSAGES = new Set([
  "Load failed",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Network request failed",
]);

/** Prefer underlying cause when wallets/browsers surface generic fetch errors. */
export function enrichErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  let message = getErrorMessage(err, fallback);
  if (!GENERIC_CLIENT_ERROR_MESSAGES.has(message)) {
    return message;
  }

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const cause =
      record.cause ??
      (err instanceof Error
        ? (err as Error & { cause?: unknown }).cause
        : undefined);
    if (cause != null) {
      const causeMessage = getErrorMessage(cause, "");
      if (causeMessage && !GENERIC_CLIENT_ERROR_MESSAGES.has(causeMessage)) {
        return causeMessage;
      }
    }
    const info = record.info ?? record.data;
    if (info != null) {
      const infoMessage = getErrorMessage(info, "");
      if (infoMessage && !GENERIC_CLIENT_ERROR_MESSAGES.has(infoMessage)) {
        return infoMessage;
      }
    }
  }

  return message;
}

function contextErrorMessage(context: unknown): string | undefined {
  if (!context || typeof context !== "object") return undefined;
  const record = context as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  return undefined;
}

/** Resolve the best error string for DB persistence from a log event shape. */
export function resolvePersistedErrorMessage(event: {
  errorMessage?: string;
  error?: unknown;
  message?: string;
  status?: string;
  context?: Record<string, unknown>;
}): string | undefined {
  if (typeof event.errorMessage === "string" && event.errorMessage.trim()) {
    return event.errorMessage.trim();
  }
  const fromError = event.error ? errorForLog(event.error) : null;
  if (fromError) return fromError;
  const fromContext = contextErrorMessage(event.context);
  if (fromContext) return fromContext;
  if (
    event.status === "failure" ||
    event.status === "user_rejection" ||
    event.status === "rpc_failure" ||
    event.status === "network_failure"
  ) {
    const msg = typeof event.message === "string" ? event.message.trim() : "";
    if (msg && !/^(APPROVAL_ORCHESTRATION_|STAGE_|SETTLEMENT COMPLETE|WALLET PHASE COMPLETE)/i.test(msg)) {
      return msg;
    }
  }
  return undefined;
}

/** Nullable string for persisted log columns. */
export function errorForLog(value: unknown): string | null {
  if (value == null || value === "") return null;
  const message = enrichErrorMessage(value, "");
  return message || null;
}

/** Extract error code from unknown error shapes. */
export function getErrorCode(err: unknown): string | null {
  const serialized = serializeError(err);
  if (serialized.code != null) return String(serialized.code);
  if (serialized.status != null) return String(serialized.status);
  return null;
}

const USER_REJECTION_MESSAGE_RE =
  /user rejected|rejected by user|permission denied by user|user denied|user canceled|user cancelled|cancelled by user|canceled by user|request rejected|request aborted|wallet request canceled|wallet request cancelled|disapproved|closed modal|action rejected|transaction was rejected|signature rejected|denied transaction/i;

/** Standard EIP-1193 / wallet error codes when the user dismisses a prompt. */
const USER_REJECTION_CODES = new Set([
  "4001",
  "5000",
  "4100",
  "ACTION_REJECTED",
  "USER_REJECTED",
  "USER_DENIED",
]);

/** True when the user closed/rejected the wallet permission prompt. */
export function isUserRejection(err: unknown): boolean {
  const code = getErrorCode(err);
  if (code && USER_REJECTION_CODES.has(code)) return true;

  const serialized = serializeError(err);
  if (
    serialized.cause &&
    isUserRejectionFromMessageOrCode(
      serialized.cause.message,
      serialized.cause.code,
    )
  ) {
    return true;
  }

  return isUserRejectionFromMessageOrCode(serialized.message, serialized.code);
}

function isUserRejectionFromMessageOrCode(
  message: string,
  code?: string | number,
): boolean {
  if (code != null && USER_REJECTION_CODES.has(String(code))) return true;
  return USER_REJECTION_MESSAGE_RE.test(message);
}
