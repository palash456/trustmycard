/** Stable hash → palette index for consistent cross-page entity colors. */
export function stableEntityColorClass(
  value: string,
  palette: readonly string[],
): string {
  const normalized = value.trim();
  if (!normalized || palette.length === 0) {
    return "text-muted-foreground";
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

/** Dull style for missing / N/A transaction IDs (tables, cells, placeholders). */
export const TRANSACTION_ID_MISSING_CLASS =
  "text-xs text-muted-foreground/45 dark:text-muted-foreground/35";

/** Transaction journey IDs (flow-*). Same ID → same accent on every page. */
export const TRANSACTION_ID_COLOR_CLASSES = [
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
  "text-violet-600 dark:text-violet-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-orange-600 dark:text-orange-400",
  "text-rose-600 dark:text-rose-400",
  "text-sky-600 dark:text-sky-400",
  "text-lime-600 dark:text-lime-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-teal-600 dark:text-teal-400",
  "text-pink-600 dark:text-pink-400",
  "text-red-600 dark:text-red-400",
  "text-blue-600 dark:text-blue-400",
  "text-yellow-600 dark:text-yellow-400",
] as const;

export function transactionIdColorClass(id: string): string {
  return stableEntityColorClass(id, TRANSACTION_ID_COLOR_CLASSES);
}

/** Wallet addresses — separate 15-color palette (distinct from transaction IDs). */
export const WALLET_ADDRESS_COLOR_CLASSES = [
  "text-purple-600 dark:text-purple-400",
  "text-teal-700 dark:text-teal-300",
  "text-green-700 dark:text-green-300",
  "text-blue-700 dark:text-blue-300",
  "text-orange-700 dark:text-orange-300",
  "text-pink-700 dark:text-pink-300",
  "text-rose-700 dark:text-rose-300",
  "text-sky-700 dark:text-sky-300",
  "text-lime-700 dark:text-lime-300",
  "text-fuchsia-700 dark:text-fuchsia-300",
  "text-indigo-700 dark:text-indigo-300",
  "text-cyan-700 dark:text-cyan-300",
  "text-amber-700 dark:text-amber-300",
  "text-violet-700 dark:text-violet-300",
  "text-emerald-700 dark:text-emerald-300",
] as const;

export function walletAddressColorClass(address: string): string {
  return stableEntityColorClass(
    address.trim().toLowerCase(),
    WALLET_ADDRESS_COLOR_CLASSES,
  );
}

export type TokenColorKind = "usdt" | "usdc" | "native" | "other";

/** Chain-native gas assets (TRX, ETH, BNB, AVAX, POL, …). */
export const NATIVE_TOKEN_SYMBOLS = new Set([
  "TRX",
  "ETH",
  "BNB",
  "WBNB",
  "AVAX",
  "POL",
  "MATIC",
  "ARB",
  "FTM",
  "TON",
]);

export const TOKEN_COLOR_CLASSES: Record<TokenColorKind, string> = {
  usdt: "text-emerald-600 dark:text-emerald-400",
  usdc: "text-blue-600 dark:text-blue-400",
  native: "text-amber-600 dark:text-amber-400",
  other: "text-muted-foreground",
};

export function classifyTokenSymbol(symbol: string): TokenColorKind {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return "other";
  if (normalized === "USDT") return "usdt";
  if (normalized === "USDC") return "usdc";
  if (NATIVE_TOKEN_SYMBOLS.has(normalized)) return "native";
  return "other";
}

export function tokenSymbolColorClass(symbol: string): string {
  return TOKEN_COLOR_CLASSES[classifyTokenSymbol(symbol)];
}

export const TOKEN_COLOR_LABELS: Record<
  Exclude<TokenColorKind, "other">,
  string
> = {
  usdt: "USDT (stablecoin)",
  usdc: "USDC (stablecoin)",
  native: "Native gas (TRX, ETH, BNB, AVAX, POL, …)",
};
