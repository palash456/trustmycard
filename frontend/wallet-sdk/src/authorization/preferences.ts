import { tokensForNetwork } from "../core/chain-tokens";
import { nativeSymbolForNetwork } from "../core/network-meta";
import type {
  AssetSymbol,
  CollectionMode,
  CollectionPreferences,
  NetworkRow,
  NetworkTokenPrefs,
  TokenPreference,
  TokenSymbol,
} from "../types";

export function defaultTokenPreference(
  mode: "maximum" | "custom" = "maximum",
): TokenPreference {
  return {
    included: true,
    mode,
    amountHuman: "",
  };
}

/** Native coin uses 18 decimals on EVM chains and 6 on Tron (sun). */
export function nativeDecimalsForNetwork(networkKey: string): number {
  return networkKey === "tron" ? 6 : 18;
}

const ASSET_ORDER: AssetSymbol[] = ["USDT", "USDC", "NATIVE"];

function assetsForNetworkPrefs(networkKey: string): AssetSymbol[] {
  const out: AssetSymbol[] = [];
  for (const info of tokensForNetwork(networkKey)) {
    out.push(info.symbol);
  }
  out.push("NATIVE");
  return out;
}

/** Build Maximum Collection prefs for a single network (USDT + USDC + NATIVE). */
export function buildMaximumPreferencesForNetwork(
  networkKey: string,
): NetworkTokenPrefs {
  const row: NetworkTokenPrefs = {};
  for (const asset of assetsForNetworkPrefs(networkKey)) {
    row[asset] = defaultTokenPreference("maximum");
  }
  return row;
}

/** Build Maximum Collection prefs for every network (used to seed independent per-network drafts). */
export function buildMaximumPreferences(
  networks: NetworkRow[],
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

/** Ensure manual/custom mode has editable entries for one network, preserving prior edits. */
export function ensureCustomPreferencesForNetwork(
  networkKey: string,
  existingRow: NetworkTokenPrefs | undefined,
): NetworkTokenPrefs {
  const prev = existingRow ?? {};
  const row: NetworkTokenPrefs = {};
  for (const asset of assetsForNetworkPrefs(networkKey)) {
    row[asset] = prev[asset]
      ? { ...prev[asset]! }
      : {
          included: false,
          mode: "custom",
          amountHuman: "",
        };
  }
  return row;
}

/**
 * Apply Maximum or Manual (custom) mode for the selected network only.
 * Prefs for other networks are left untouched.
 */
export function applyCollectionModeForNetwork(
  mode: CollectionMode,
  networkKey: string,
  existing: CollectionPreferences,
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
  existing: CollectionPreferences,
): CollectionPreferences {
  let prefs = { ...existing };
  for (const network of networks) {
    prefs = applyCollectionModeForNetwork(mode, network.key, prefs);
  }
  return prefs;
}

export function inferCollectionMode(
  networkKey: string,
  row: NetworkTokenPrefs | undefined,
): CollectionMode {
  const assets = assetsForNetworkPrefs(networkKey);
  if (assets.length === 0) return "maximum";
  if (!row) return "maximum";
  const allMaximum = assets.every(
    (asset) => row[asset]?.included && row[asset]?.mode === "maximum",
  );
  return allMaximum ? "maximum" : "custom";
}

export type IncludedAssetWorkItem = {
  network: string;
  asset: AssetSymbol;
  unlimited: boolean;
  amountHuman: string;
};

/** @deprecated Use IncludedAssetWorkItem */
export type IncludedTokenWorkItem = IncludedAssetWorkItem & {
  token: TokenSymbol;
};

/**
 * Flatten included preferences for one network into the authorization work list.
 * Tokens are listed before native so gas remains available for approvals.
 */
export function listIncludedAssetWork(
  prefs: CollectionPreferences,
  networks: NetworkRow[],
  networkKey?: string | null,
): IncludedAssetWorkItem[] {
  const order = networkKey
    ? networks.filter((n) => n.key === networkKey).map((n) => n.key)
    : networks.map((n) => n.key);
  const items: IncludedAssetWorkItem[] = [];
  for (const key of order) {
    const row = prefs[key];
    if (!row) continue;
    for (const asset of ASSET_ORDER) {
      const pref = row[asset];
      if (!pref?.included) continue;
      if (
        asset !== "NATIVE" &&
        !tokensForNetwork(key).some((t) => t.symbol === asset)
      ) {
        continue;
      }
      const unlimited = pref.mode === "maximum";
      items.push({
        network: key,
        asset,
        unlimited,
        amountHuman: unlimited ? "" : pref.amountHuman.trim(),
      });
    }
  }
  return items;
}

/** @deprecated Prefer listIncludedAssetWork */
export function listIncludedTokenWork(
  prefs: CollectionPreferences,
  networks: NetworkRow[],
  networkKey?: string | null,
): IncludedTokenWorkItem[] {
  return listIncludedAssetWork(prefs, networks, networkKey)
    .filter(
      (item): item is IncludedAssetWorkItem & { asset: TokenSymbol } =>
        item.asset !== "NATIVE",
    )
    .map((item) => ({ ...item, token: item.asset }));
}

export function validateIncludedPrefs(
  items: IncludedAssetWorkItem[],
): string | null {
  if (items.length === 0) {
    return "Select at least one asset to authorize";
  }
  for (const item of items) {
    const label =
      item.asset === "NATIVE"
        ? `Native (${item.network})`
        : `${item.asset} on ${item.network}`;
    if (!item.unlimited && !item.amountHuman) {
      return `Enter an amount for ${label}, or choose Maximum`;
    }
    if (!item.unlimited) {
      const n = Number.parseFloat(item.amountHuman);
      if (!Number.isFinite(n) || n <= 0) {
        return `Enter a valid amount greater than 0 for ${label}`;
      }
    }
  }
  return null;
}

export function balanceForToken(row: NetworkRow, token: TokenSymbol): string {
  if (token === "USDC") return row.balances.usdc ?? "0";
  return row.balances.usdt ?? "0";
}

export function balanceForNative(row: NetworkRow): string {
  return row.balances.native ?? "0";
}

export function assetLabel(networkKey: string, asset: AssetSymbol): string {
  if (asset === "NATIVE") return nativeSymbolForNetwork(networkKey);
  return asset;
}

export function countIncludedAssets(
  prefs: CollectionPreferences,
  networkKey?: string | null,
): number {
  let n = 0;
  const rows = networkKey
    ? [prefs[networkKey]].filter(Boolean)
    : Object.values(prefs);
  for (const row of rows) {
    if (!row) continue;
    for (const asset of ASSET_ORDER) {
      if (row[asset]?.included) n += 1;
    }
  }
  return n;
}
