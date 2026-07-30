import { getErrorMessage } from "@trustmycard/shared/observability";

export {
  getErrorMessage,
  errorForLog,
  serializeError,
  getErrorCode,
  isUserRejection,
} from "@trustmycard/shared/observability";

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
