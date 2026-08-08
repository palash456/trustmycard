import { shouldSuppressWalletConsoleErrorForTest } from "./errors";

const CONSOLE_METHODS = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "table",
  "dir",
  "dirxml",
  "group",
  "groupCollapsed",
  "groupEnd",
  "time",
  "timeEnd",
  "timeLog",
  "count",
  "countReset",
  "assert",
  "profile",
  "profileEnd",
  "clear",
] as const;

let consolePolicyInstalled = false;

function isProductionBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "production"
  );
}

function silenceAllConsoleMethods(): void {
  for (const method of CONSOLE_METHODS) {
    try {
      const consoleRef = console as unknown as Record<string, unknown>;
      if (typeof consoleRef[method] === "function") {
        consoleRef[method] = () => {};
      }
    } catch {
      /* fail-open */
    }
  }
}

/**
 * Production: no browser console output (including third-party SDK noise).
 * Development: keep console, but mute known WalletConnect cancellation noise.
 */
export function installBrowserConsolePolicy(): void {
  if (typeof window === "undefined" || consolePolicyInstalled) return;
  consolePolicyInstalled = true;

  if (isProductionBrowser()) {
    silenceAllConsoleMethods();
    return;
  }

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (shouldSuppressWalletConsoleErrorForTest(args)) return;
    originalError(...args);
  };
}
