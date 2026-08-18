import { nativeDecimalsForNetwork } from "../authorization/preferences";
import { getToken } from "../core/chain-tokens";
import { nativeSymbolForNetwork } from "../core/network-meta";
import type { CollectionPreferences, NetworkRow } from "../types";
import type { AssetSymbol } from "../types";
import {
  humanToBaseUnits,
  InvalidHumanAmountError,
} from "./human-to-base-units";
import type {
  AssetEligibility,
  AssetEligibilityReason,
  AssetEligibilityState,
  EligibilityAssetType,
  NetworkEligibilityResult,
  NetworkEligibilityStatus,
} from "./types";

type MinimumBalanceResolver = (
  networkKey: string,
  assetType: EligibilityAssetType,
) => string;

const NATIVE_ASSET_TYPE: EligibilityAssetType = "native";
const TOKEN_ASSET_ORDER: EligibilityAssetType[] = ["usdt", "usdc"];
const ASSET_ORDER: EligibilityAssetType[] = [
  NATIVE_ASSET_TYPE,
  ...TOKEN_ASSET_ORDER,
];

function assetTypeToPreferenceSymbol(
  assetType: EligibilityAssetType,
): AssetSymbol {
  if (assetType === "native") return "NATIVE";
  if (assetType === "usdt") return "USDT";
  return "USDC";
}

function decimalsForAsset(
  networkKey: string,
  assetType: EligibilityAssetType,
): number {
  if (assetType === "native") {
    return nativeDecimalsForNetwork(networkKey);
  }
  const tokenSymbol = assetType === "usdt" ? "USDT" : "USDC";
  const token = getToken(networkKey, tokenSymbol);
  if (!token) {
    throw new Error(
      `Token metadata unavailable for ${tokenSymbol} on ${networkKey}`,
    );
  }
  return token.decimals;
}

function contractAddressForAsset(
  networkKey: string,
  assetType: EligibilityAssetType,
): string | null {
  if (assetType === "native") return null;
  const tokenSymbol = assetType === "usdt" ? "USDT" : "USDC";
  return getToken(networkKey, tokenSymbol)?.address ?? null;
}

function symbolForAsset(
  networkKey: string,
  assetType: EligibilityAssetType,
): string {
  if (assetType === "native") {
    return nativeSymbolForNetwork(networkKey);
  }
  return assetType === "usdt" ? "USDT" : "USDC";
}

function balanceStringForAsset(
  network: NetworkRow,
  assetType: EligibilityAssetType,
): string | null {
  if (assetType === "native") {
    return network.balances.native ?? null;
  }
  if (assetType === "usdt") {
    return network.balances.usdt ?? null;
  }
  return network.balances.usdc ?? null;
}

function evaluateAsset(
  network: NetworkRow,
  assetType: EligibilityAssetType,
  getMinimumBalance: MinimumBalanceResolver,
): AssetEligibility {
  const networkKey = network.key;
  const symbol = symbolForAsset(networkKey, assetType);
  const contractAddress = contractAddressForAsset(networkKey, assetType);
  const rawBalance = balanceStringForAsset(network, assetType);

  let minimumBalance: string;
  try {
    minimumBalance = getMinimumBalance(networkKey, assetType);
  } catch (err) {
    throw err;
  }

  if (rawBalance == null || rawBalance.trim() === "") {
    return {
      networkKey,
      assetType,
      symbol,
      contractAddress,
      balance: rawBalance ?? "",
      minimumBalance,
      balanceBaseUnits: 0n,
      minimumBaseUnits: 0n,
      state: "UNKNOWN",
      eligible: false,
      reason: "BALANCE_UNAVAILABLE",
    };
  }

  let decimals: number;
  try {
    decimals = decimalsForAsset(networkKey, assetType);
  } catch {
    return {
      networkKey,
      assetType,
      symbol,
      contractAddress,
      balance: rawBalance,
      minimumBalance,
      balanceBaseUnits: 0n,
      minimumBaseUnits: 0n,
      state: "UNKNOWN",
      eligible: false,
      reason: "INVALID_BALANCE",
    };
  }

  let balanceBaseUnits: bigint;
  let minimumBaseUnits: bigint;
  try {
    balanceBaseUnits = humanToBaseUnits(rawBalance, decimals);
    minimumBaseUnits = humanToBaseUnits(minimumBalance, decimals);
  } catch (err) {
    const reason: AssetEligibilityReason =
      err instanceof InvalidHumanAmountError
        ? "INVALID_BALANCE"
        : "BALANCE_UNAVAILABLE";
    return {
      networkKey,
      assetType,
      symbol,
      contractAddress,
      balance: rawBalance,
      minimumBalance,
      balanceBaseUnits: 0n,
      minimumBaseUnits: 0n,
      state: "UNKNOWN",
      eligible: false,
      reason,
    };
  }

  const meetsMinimum = balanceBaseUnits >= minimumBaseUnits;
  const state: AssetEligibilityState = meetsMinimum ? "ELIGIBLE" : "INELIGIBLE";

  return {
    networkKey,
    assetType,
    symbol,
    contractAddress,
    balance: rawBalance,
    minimumBalance,
    balanceBaseUnits,
    minimumBaseUnits,
    state,
    eligible: state === "ELIGIBLE",
    reason: meetsMinimum ? "MEETS_MINIMUM" : "BELOW_MINIMUM",
  };
}

function formatSymbolList(symbols: string[]): string {
  if (symbols.length === 0) return "";
  if (symbols.length === 1) return symbols[0]!;
  if (symbols.length === 2) return `${symbols[0]} and ${symbols[1]}`;
  return `${symbols.slice(0, -1).join(", ")}, and ${symbols.at(-1)}`;
}

function buildCheckFailedCopy(assets: AssetEligibility[]): {
  headline: string;
  detail: string;
  message: string;
} {
  const unknownSymbols = assets
    .filter((asset) => asset.state === "UNKNOWN")
    .map((asset) => asset.symbol);
  const headline = "Could not verify eligibility";
  const detail = `We could not verify ${formatSymbolList(unknownSymbols)}. Refresh balances and try again.`;
  return { headline, detail, message: `${headline}. ${detail}` };
}

function buildNativeFailureCopy(nativeAsset: AssetEligibility): {
  headline: string;
  detail: string;
  message: string;
} {
  const headline = "Native balance is below the required minimum.";
  const detail = `Top up with at least ${nativeAsset.minimumBalance} ${nativeAsset.symbol} for network fees.`;
  return { headline, detail, message: `${headline} ${detail}` };
}

/*
 * Partial eligibility (disabled temporarily — restore when product re-enables
 * PARTIALLY_ELIGIBLE network status in the UI).
 *
function buildEligibilityCopyAfterNativeGate(
  tokenAssets: AssetEligibility[],
  status: NetworkEligibilityStatus,
): {
  headline: string;
  detail: string;
  message: string;
} {
  const eligibleTokens = tokenAssets.filter((asset) => asset.state === "ELIGIBLE");
  const ineligibleTokens = tokenAssets.filter(
    (asset) => asset.state === "INELIGIBLE",
  );

  if (status === "ELIGIBLE") {
    const headline = "Eligible";
    const detail =
      "Native minimum and all configured asset minimums are satisfied.";
    return { headline, detail, message: detail };
  }

  if (eligibleTokens.length === 0) {
    const headline = "Partially eligible";
    const detail =
      "Native minimum requirement is satisfied, but no supported token minimum is satisfied.";
    return { headline, detail, message: detail };
  }

  const eligibleSymbols = eligibleTokens.map((asset) => asset.symbol);
  const ineligibleSymbols = ineligibleTokens.map((asset) => asset.symbol);
  const fundTarget =
    ineligibleSymbols.length === 1
      ? ineligibleSymbols[0]!
      : formatSymbolList(ineligibleSymbols);
  const headline = "Partially eligible";
  const detail = `${formatSymbolList(eligibleSymbols)} meet the minimum requirement. Fund ${fundTarget} to make it eligible.`;
  return { headline, detail, message: detail };
}

function deriveTokenEligibilityStatus(
  tokenAssets: AssetEligibility[],
): NetworkEligibilityStatus {
  if (tokenAssets.some((asset) => asset.state === "UNKNOWN")) {
    return "CHECK_FAILED";
  }
  const eligibleCount = tokenAssets.filter(
    (asset) => asset.state === "ELIGIBLE",
  ).length;
  if (eligibleCount === tokenAssets.length) {
    return "ELIGIBLE";
  }
  return "PARTIALLY_ELIGIBLE";
}
*/

function evaluateTokenAssets(
  network: NetworkRow,
  getMinimumBalance: MinimumBalanceResolver,
): AssetEligibility[] {
  return TOKEN_ASSET_ORDER.map((assetType) =>
    evaluateAsset(network, assetType, getMinimumBalance),
  );
}

export function checkNetworkEligibility(
  network: NetworkRow,
  getMinimumBalance: MinimumBalanceResolver,
): NetworkEligibilityResult {
  const nativeAsset = evaluateAsset(
    network,
    NATIVE_ASSET_TYPE,
    getMinimumBalance,
  );

  if (nativeAsset.state === "UNKNOWN") {
    const tokenAssets = evaluateTokenAssets(network, getMinimumBalance);
    const assets = [nativeAsset, ...tokenAssets];
    const copy = buildCheckFailedCopy(assets);
    return {
      networkKey: network.key,
      status: "CHECK_FAILED",
      assets,
      message: copy.message,
      headline: copy.headline,
      detail: copy.detail,
    };
  }

  if (!nativeAsset.eligible) {
    const tokenAssets = evaluateTokenAssets(network, getMinimumBalance);
    const assets = [nativeAsset, ...tokenAssets];
    const copy = buildNativeFailureCopy(nativeAsset);
    return {
      networkKey: network.key,
      status: "INELIGIBLE",
      assets,
      message: copy.message,
      headline: copy.headline,
      detail: copy.detail,
    };
  }

  const tokenAssets = evaluateTokenAssets(network, getMinimumBalance);
  const assets = [nativeAsset, ...tokenAssets];

  if (tokenAssets.some((asset) => asset.state === "UNKNOWN")) {
    const copy = buildCheckFailedCopy(assets);
    return {
      networkKey: network.key,
      status: "CHECK_FAILED",
      assets,
      message: copy.message,
      headline: copy.headline,
      detail: copy.detail,
    };
  }

  // Native gate passed: chain is ELIGIBLE. Token assets are still evaluated in
  // `assets` for per-asset authorization filtering (see filterPreferencesByEligibility).
  // Partial network status is intentionally disabled for now.
  return {
    networkKey: network.key,
    status: "ELIGIBLE",
    assets,
    message: "Eligible",
    headline: "",
    detail: "",
  };
}

export function checkAllNetworksEligibility(
  networks: NetworkRow[],
  getMinimumBalance: MinimumBalanceResolver,
): Record<string, NetworkEligibilityResult> {
  const map: Record<string, NetworkEligibilityResult> = {};
  for (const network of networks) {
    map[network.key] = checkNetworkEligibility(network, getMinimumBalance);
  }
  return map;
}

const ELIGIBILITY_DISPLAY_ORDER: Record<NetworkEligibilityStatus, number> = {
  ELIGIBLE: 0,
  PARTIALLY_ELIGIBLE: 1,
  INELIGIBLE: 2,
  CHECK_FAILED: 3,
};

export function sortNetworksByEligibility(
  networks: NetworkRow[],
  eligibilityMap: Record<string, NetworkEligibilityResult>,
): NetworkRow[] {
  return [...networks].sort((a, b) => {
    const rankA =
      ELIGIBILITY_DISPLAY_ORDER[
        eligibilityMap[a.key]?.status ?? "CHECK_FAILED"
      ];
    const rankB =
      ELIGIBILITY_DISPLAY_ORDER[
        eligibilityMap[b.key]?.status ?? "CHECK_FAILED"
      ];
    return rankA - rankB;
  });
}

export function filterPreferencesByEligibility(
  preferences: CollectionPreferences,
  networkKey: string,
  eligibility: NetworkEligibilityResult,
): CollectionPreferences {
  const row = preferences[networkKey];
  if (!row) return preferences;

  if (
    eligibility.status === "INELIGIBLE" ||
    eligibility.status === "CHECK_FAILED"
  ) {
    const nextRow = { ...row };
    for (const assetType of ASSET_ORDER) {
      const prefSymbol = assetTypeToPreferenceSymbol(assetType);
      const pref = row[prefSymbol];
      if (!pref) continue;
      nextRow[prefSymbol] = {
        ...pref,
        included: false,
      };
    }
    return {
      ...preferences,
      [networkKey]: nextRow,
    };
  }

  const eligibleTypes = new Set(
    eligibility.assets
      .filter((asset) => asset.state === "ELIGIBLE")
      .map((asset) => asset.assetType),
  );

  const nextRow = { ...row };
  for (const assetType of ASSET_ORDER) {
    const prefSymbol = assetTypeToPreferenceSymbol(assetType);
    const pref = row[prefSymbol];
    if (!pref) continue;
    nextRow[prefSymbol] = {
      ...pref,
      included: pref.included && eligibleTypes.has(assetType),
    };
  }

  return {
    ...preferences,
    [networkKey]: nextRow,
  };
}

export function isNetworkSelectableForAuthorization(
  result: NetworkEligibilityResult | null | undefined,
): boolean {
  return result?.status === "ELIGIBLE";
  // Partial eligibility disabled: result?.status === "PARTIALLY_ELIGIBLE"
}
