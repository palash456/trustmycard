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
const WALLETCONNECT_NOISE_RE =
  /request\(\) -> isValidRequest\(\) failed|Missing or invalid\. request\(\) method: wallet_getCapabilities|No internet connection detected\. Please restart your network and try again\./i;
const WALLETCONNECT_EXPLORER_FETCH_RE =
  /Failed to fetch[\s\S]*(fetchListings|getDesktopListings|getRecomendedWallets|WcmExplorerContext|wcm-modal)/i;

const OBJECT_COERCED = "[object Object]";

function consoleArgText(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`;
  }
  if (arg && typeof arg === "object") {
    const record = arg as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ["msg", "message", "reason", "stack"]) {
      const value = record[key];
      if (typeof value === "string") parts.push(value);
    }
    if (parts.length > 0) return parts.join("\n");
    try {
      return JSON.stringify(arg);
    } catch {
      return "";
    }
  }
  return "";
}

function hasExtractableConsoleMessage(arg: unknown): boolean {
  if (typeof arg === "string") return arg.trim().length > 0;
  if (typeof arg === "number" || typeof arg === "boolean") return true;
  if (arg instanceof Error) {
    const msg = arg.message?.trim() ?? "";
    return msg.length > 0 && msg !== OBJECT_COERCED;
  }
  if (arg && typeof arg === "object") {
    const record = arg as Record<string, unknown>;
    if (typeof record.message === "string" && !record.message.trim()) {
      const otherKeys = Object.keys(record).filter((k) => k !== "message");
      if (otherKeys.length === 0) return false;
    }
    const msg = getErrorMessage(arg, "").trim();
    return msg.length > 0 && msg !== "{}";
  }
  return false;
}

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

function shouldSuppressWalletConsoleError(args: unknown[]): boolean {
  if (args.length === 0) return true;
  if (looksLikeCancellationLog(args)) return true;
  const joined = args.map(consoleArgText).filter(Boolean).join("\n");
  if (WALLETCONNECT_NOISE_RE.test(joined)) return true;
  if (WALLETCONNECT_EXPLORER_FETCH_RE.test(joined)) return true;
  // WalletConnect relay/session code often calls console.error({}) with no payload.
  // Next.js dev turns that into a scary overlay even though connect still works.
  if (!args.some(hasExtractableConsoleMessage)) return true;
  return false;
}

/**
 * WalletConnect calls console.error on user cancel and sometimes with empty `{}`
 * during relay handshake. Next.js dev mode turns those into fullscreen overlays.
 * In production, all browser console output is silenced.
 */
export function muteWalletCancellationConsoleErrors() {
  const { installBrowserConsolePolicy } = require("./browser-console") as {
    installBrowserConsolePolicy: () => void;
  };
  installBrowserConsolePolicy();
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

/** @internal Exported for unit tests. */
export function shouldSuppressWalletConsoleErrorForTest(
  args: unknown[]
): boolean {
  return shouldSuppressWalletConsoleError(args);
}
