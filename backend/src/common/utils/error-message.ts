const OBJECT_COERCED = "[object Object]";

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
    return serialized.length > 500 ? `${serialized.slice(0, 497)}...` : serialized;
  } catch {
    return null;
  }
}

/** Normalize API / wallet errors into a readable string. */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong"
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

/** Nullable string for persisted log columns. */
export function errorForLog(value: unknown): string | null {
  if (value == null || value === "") return null;
  const message = getErrorMessage(value, "");
  return message || null;
}
