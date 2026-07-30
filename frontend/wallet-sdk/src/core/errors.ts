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

/** Extract a readable message from wallet / RPC rejection shapes. */
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

/** Nullable string for persisted telemetry / log columns. */
export function errorForLog(value: unknown): string | null {
  if (value == null || value === "") return null;
  const message = getErrorMessage(value, "");
  return message || null;
}

/** True when the user closed/rejected the wallet permission prompt. */
export function isUserRejection(err: unknown): boolean {
  const message = getErrorMessage(err, "");
  // Only treat explicit wallet/user-action phrases as user rejection.
  // Avoid broad terms like "rejected" because backend/node errors may include them
  // (e.g. "Tron broadcast rejected: insufficient Bandwidth/Energy/TRX").
  return /user rejected|rejected by user|permission denied by user|user denied|user canceled|user cancelled|cancelled by user|canceled by user|request rejected|request aborted|wallet request canceled|wallet request cancelled/i.test(
    message
  );
}

const CANCEL_LOG_RE =
  /user canceled|user cancelled|user rejected|rejected by user|denied by user/i;

function looksLikeCancellationLog(args: unknown[]): boolean {
  for (const arg of args) {
    if (typeof arg === "string" && CANCEL_LOG_RE.test(arg)) return true;
    if (arg instanceof Error && CANCEL_LOG_RE.test(arg.message)) return true;
    if (arg && typeof arg === "object") {
      const msg = getErrorMessage(arg, "");
      if (msg && CANCEL_LOG_RE.test(msg)) return true;
    }
  }
  // WC often logs: console.error({}, "User canceled")
  const joined = args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.message;
      return "";
    })
    .join(" ");
  return CANCEL_LOG_RE.test(joined);
}

let cancellationMuteInstalled = false;

/**
 * WalletConnect calls console.error on user cancel. Next.js dev mode turns
 * that into a fullscreen overlay. Mute only those cancellation logs.
 */
export function muteWalletCancellationConsoleErrors() {
  if (typeof window === "undefined" || cancellationMuteInstalled) return;
  cancellationMuteInstalled = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (looksLikeCancellationLog(args)) return;
    originalError(...args);
  };
}

/**
 * Temporarily mute cancellation console.errors around a wallet prompt await.
 */
export async function withSilentWalletCancellation<T>(
  fn: () => Promise<T>
): Promise<T> {
  muteWalletCancellationConsoleErrors();
  return fn();
}
