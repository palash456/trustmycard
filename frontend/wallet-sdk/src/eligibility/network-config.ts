import type { SupportedNetworkKey } from "@trustmycard/shared/constants/native-chains";
import {
  buildNetworkConfigFromEnv,
  getAllowedNetworkKeys,
  getNetworkMinimumBalanceFromConfig,
  isNetworkAllowedKey,
  type NetworkAllowEnvKey,
  type NetworkConfigMap,
  type NetworkMinimumAsset,
} from "@trustmycard/shared/constants/network-env-parsers";
import type { EligibilityAssetType } from "./types";

/**
 * Static process.env references so Next.js can inline NEXT_PUBLIC_* values
 * into the client bundle. Dynamic process.env[name] lookups are not replaced.
 */
function envSnapshot(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_ALLOW_ETH: process.env.NEXT_PUBLIC_ALLOW_ETH,
    NEXT_PUBLIC_ALLOW_BSC: process.env.NEXT_PUBLIC_ALLOW_BSC,
    NEXT_PUBLIC_ALLOW_POLYGON: process.env.NEXT_PUBLIC_ALLOW_POLYGON,
    NEXT_PUBLIC_ALLOW_AVAX: process.env.NEXT_PUBLIC_ALLOW_AVAX,
    NEXT_PUBLIC_ALLOW_ARB: process.env.NEXT_PUBLIC_ALLOW_ARB,
    NEXT_PUBLIC_ALLOW_BASE: process.env.NEXT_PUBLIC_ALLOW_BASE,
    NEXT_PUBLIC_ALLOW_OP: process.env.NEXT_PUBLIC_ALLOW_OP,
    NEXT_PUBLIC_ALLOW_TRON: process.env.NEXT_PUBLIC_ALLOW_TRON,
    NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_ETH_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_ETH_MIN_USDT_BALANCE,
    NEXT_PUBLIC_ETH_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_ETH_MIN_USDC_BALANCE,
    NEXT_PUBLIC_BSC_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_BSC_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_BSC_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_BSC_MIN_USDT_BALANCE,
    NEXT_PUBLIC_BSC_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_BSC_MIN_USDC_BALANCE,
    NEXT_PUBLIC_POLYGON_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_POLYGON_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_POLYGON_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_POLYGON_MIN_USDT_BALANCE,
    NEXT_PUBLIC_POLYGON_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_POLYGON_MIN_USDC_BALANCE,
    NEXT_PUBLIC_AVAX_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_AVAX_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_AVAX_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_AVAX_MIN_USDT_BALANCE,
    NEXT_PUBLIC_AVAX_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_AVAX_MIN_USDC_BALANCE,
    NEXT_PUBLIC_ARB_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_ARB_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_ARB_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_ARB_MIN_USDT_BALANCE,
    NEXT_PUBLIC_ARB_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_ARB_MIN_USDC_BALANCE,
    NEXT_PUBLIC_BASE_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_BASE_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_BASE_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_BASE_MIN_USDT_BALANCE,
    NEXT_PUBLIC_BASE_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_BASE_MIN_USDC_BALANCE,
    NEXT_PUBLIC_OP_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_OP_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_OP_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_OP_MIN_USDT_BALANCE,
    NEXT_PUBLIC_OP_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_OP_MIN_USDC_BALANCE,
    NEXT_PUBLIC_TRON_MIN_NATIVE_BALANCE:
      process.env.NEXT_PUBLIC_TRON_MIN_NATIVE_BALANCE,
    NEXT_PUBLIC_TRON_MIN_USDT_BALANCE:
      process.env.NEXT_PUBLIC_TRON_MIN_USDT_BALANCE,
    NEXT_PUBLIC_TRON_MIN_USDC_BALANCE:
      process.env.NEXT_PUBLIC_TRON_MIN_USDC_BALANCE,
  };
}

let cachedConfig: NetworkConfigMap | null = null;

export function getNetworkConfig(): NetworkConfigMap {
  if (!cachedConfig) {
    cachedConfig = buildNetworkConfigFromEnv(envSnapshot());
  }
  return cachedConfig;
}

/** Normalized per-network configuration (allow + minimum balances). */
export const networkConfig = new Proxy({} as NetworkConfigMap, {
  get(_target, prop: string) {
    return getNetworkConfig()[prop as NetworkAllowEnvKey];
  },
});

export function isNetworkAllowed(networkKey: string): boolean {
  return isNetworkAllowedKey(networkKey, getNetworkConfig());
}

export function getAllowedNetworks(): SupportedNetworkKey[] {
  return getAllowedNetworkKeys(getNetworkConfig()) as SupportedNetworkKey[];
}

function assetToMinimumKey(asset: EligibilityAssetType): NetworkMinimumAsset {
  return asset;
}

export function getNetworkMinimumBalance(
  networkKey: string,
  asset: EligibilityAssetType,
): string {
  return getNetworkMinimumBalanceFromConfig(
    networkKey,
    assetToMinimumKey(asset),
    getNetworkConfig(),
  );
}

/** Reset cached config — for tests only. */
export function resetNetworkConfigCacheForTests(): void {
  cachedConfig = null;
}

export function buildNetworkConfigForTests(
  env: Record<string, string | undefined>,
): NetworkConfigMap {
  return buildNetworkConfigFromEnv(env);
}

export {
  parseAllowBoolean,
  parseMinimumBalance,
} from "@trustmycard/shared/constants/network-env-parsers";
