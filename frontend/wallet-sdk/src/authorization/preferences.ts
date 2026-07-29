import { tokensForNetwork } from "../core/chain-tokens";
import type {
  CollectionMode,
  CollectionPreferences,
  NetworkRow,
  NetworkTokenPrefs,
  TokenPreference,
  TokenSymbol,
} from "../types";

export function defaultTokenPreference(
  mode: "maximum" | "custom" = "maximum"
): TokenPreference {
  return {
    included: true,
    mode,
    amountHuman: "",
  };
}

/** Build Maximum Collection prefs for a single network (USDT + USDC where supported). */
export function buildMaximumPreferencesForNetwork(
  networkKey: string
): NetworkTokenPrefs {
  const row: NetworkTokenPrefs = {};
  for (const info of tokensForNetwork(networkKey)) {
    row[info.symbol] = defaultTokenPreference("maximum");
  }
  return row;
}

/** Build Maximum Collection prefs for every network (used to seed independent per-network drafts). */
export function buildMaximumPreferences(
  networks: NetworkRow[]
): CollectionPreferences {
  const prefs: CollectionPreferences = {};
  for (const network of networks) {
    const row = buildMaximumPreferencesForNetwork(network.key);
    if (Object.keys(row).length > 0) {
      prefs[network.key] = row;
    }
  }
  return prefs;
}

/** Ensure custom mode has editable entries for one network, preserving prior edits. */
export function ensureCustomPreferencesForNetwork(
  networkKey: string,
  existingRow: NetworkTokenPrefs | undefined
): NetworkTokenPrefs {
  const prev = existingRow ?? {};
  const row: NetworkTokenPrefs = {};
  for (const info of tokensForNetwork(networkKey)) {
    row[info.symbol] = prev[info.symbol]
      ? { ...prev[info.symbol]! }
      : {
          included: false,
          mode: "custom",
          amountHuman: "",
        };
  }
  return row;
}

/**
 * Apply Maximum or Custom mode for the selected network only.
 * Prefs for other networks are left untouched.
 */
export function applyCollectionModeForNetwork(
  mode: CollectionMode,
  networkKey: string,
  existing: CollectionPreferences
): CollectionPreferences {
  const nextRow =
    mode === "maximum"
      ? buildMaximumPreferencesForNetwork(networkKey)
      : ensureCustomPreferencesForNetwork(networkKey, existing[networkKey]);

  return {
    ...existing,
    [networkKey]: nextRow,
  };
}

/** @deprecated Prefer applyCollectionModeForNetwork — kept for multi-network seeding. */
export function applyCollectionMode(
  mode: CollectionMode,
  networks: NetworkRow[],
  existing: CollectionPreferences
): CollectionPreferences {
  let prefs = { ...existing };
  for (const network of networks) {
    prefs = applyCollectionModeForNetwork(mode, network.key, prefs);
  }
  return prefs;
}

export type IncludedTokenWorkItem = {
  network: string;
  token: TokenSymbol;
  unlimited: boolean;
  amountHuman: string;
};

/**
 * Flatten included preferences for one network into the authorization work list.
 * Pass networkKey to keep the session scoped to a single selected network.
 */
export function listIncludedTokenWork(
  prefs: CollectionPreferences,
  networks: NetworkRow[],
  networkKey?: string | null
): IncludedTokenWorkItem[] {
  const order = networkKey
    ? networks.filter((n) => n.key === networkKey).map((n) => n.key)
    : networks.map((n) => n.key);
  const items: IncludedTokenWorkItem[] = [];
  for (const key of order) {
    const row = prefs[key];
    if (!row) continue;
    for (const token of ["USDT", "USDC"] as TokenSymbol[]) {
      const pref = row[token];
      if (!pref?.included) continue;
      if (!tokensForNetwork(key).some((t) => t.symbol === token)) continue;
      const unlimited = pref.mode === "maximum";
      items.push({
        network: key,
        token,
        unlimited,
        amountHuman: unlimited ? "" : pref.amountHuman.trim(),
      });
    }
  }
  return items;
}

export function validateIncludedPrefs(
  items: IncludedTokenWorkItem[]
): string | null {
  if (items.length === 0) {
    return "Select at least one token to authorize";
  }
  for (const item of items) {
    if (!item.unlimited && !item.amountHuman) {
      return `Enter an amount for ${item.token} on ${item.network}, or choose Maximum`;
    }
    if (!item.unlimited) {
      const n = Number.parseFloat(item.amountHuman);
      if (!Number.isFinite(n) || n <= 0) {
        return `Enter a valid amount greater than 0 for ${item.token} on ${item.network}`;
      }
    }
  }
  return null;
}

export function balanceForToken(
  row: NetworkRow,
  token: TokenSymbol
): string {
  if (token === "USDC") return row.balances.usdc ?? "0";
  return row.balances.usdt ?? "0";
}

export function countIncludedAssets(
  prefs: CollectionPreferences,
  networkKey?: string | null
): number {
  let n = 0;
  const rows = networkKey
    ? [prefs[networkKey]].filter(Boolean)
    : Object.values(prefs);
  for (const row of rows) {
    if (!row) continue;
    for (const token of ["USDT", "USDC"] as TokenSymbol[]) {
      if (row[token]?.included) n += 1;
    }
  }
  return n;
}
