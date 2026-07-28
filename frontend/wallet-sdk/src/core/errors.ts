/** Extract a readable message from wallet / RPC rejection shapes. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.reason === "string" && o.reason) return o.reason;
    if (typeof o.error === "string" && o.error) return o.error;
    if (o.error && typeof o.error === "object") {
      const nested = o.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message) {
        return nested.message;
      }
    }
  }
  return fallback;
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
