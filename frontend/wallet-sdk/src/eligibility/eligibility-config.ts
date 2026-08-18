import type { EligibilityAssetType } from "./types";

const NETWORK_ENV_PREFIX: Record<string, string> = {
  eth: "NEXT_PUBLIC_ETH_",
  bsc: "NEXT_PUBLIC_BSC_",
  pol: "NEXT_PUBLIC_POLYGON_",
  avax: "NEXT_PUBLIC_AVAX_",
  arb: "NEXT_PUBLIC_ARB_",
  base: "NEXT_PUBLIC_BASE_",
  tron: "NEXT_PUBLIC_TRON_",
};

const ASSET_ENV_SUFFIX: Record<EligibilityAssetType, string> = {
  native: "MIN_NATIVE_BALANCE",
  usdt: "MIN_USDT_BALANCE",
  usdc: "MIN_USDC_BALANCE",
};

/**
 * Static process.env references so Next.js can inline NEXT_PUBLIC_* values
 * into the client bundle. Dynamic process.env[name] lookups are not replaced.
 */
function minimumBalances(): Record<
  string,
  Record<EligibilityAssetType, string | undefined>
> {
  return {
    eth: {
      native: process.env.NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_ETH_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_ETH_MIN_USDC_BALANCE,
    },
    bsc: {
      native: process.env.NEXT_PUBLIC_BSC_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_BSC_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_BSC_MIN_USDC_BALANCE,
    },
    pol: {
      native: process.env.NEXT_PUBLIC_POLYGON_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_POLYGON_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_POLYGON_MIN_USDC_BALANCE,
    },
    avax: {
      native: process.env.NEXT_PUBLIC_AVAX_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_AVAX_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_AVAX_MIN_USDC_BALANCE,
    },
    arb: {
      native: process.env.NEXT_PUBLIC_ARB_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_ARB_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_ARB_MIN_USDC_BALANCE,
    },
    base: {
      native: process.env.NEXT_PUBLIC_BASE_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_BASE_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_BASE_MIN_USDC_BALANCE,
    },
    tron: {
      native: process.env.NEXT_PUBLIC_TRON_MIN_NATIVE_BALANCE,
      usdt: process.env.NEXT_PUBLIC_TRON_MIN_USDT_BALANCE,
      usdc: process.env.NEXT_PUBLIC_TRON_MIN_USDC_BALANCE,
    },
  };
}

function envVarName(networkKey: string, assetType: EligibilityAssetType): string {
  const prefix = NETWORK_ENV_PREFIX[networkKey];
  if (!prefix) {
    throw new Error(
      `Unknown network key "${networkKey}" — no eligibility configuration mapping exists`,
    );
  }
  return `${prefix}${ASSET_ENV_SUFFIX[assetType]}`;
}

function parseMinimumValue(varName: string, value: string | undefined): string {
  if (value == null || value.trim() === "") {
    throw new Error(`Missing eligibility configuration: ${varName}`);
  }
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid eligibility configuration: ${varName}="${trimmed}"`);
  }
  return trimmed;
}

export function getMinimumBalance(
  networkKey: string,
  assetType: EligibilityAssetType,
): string {
  const varName = envVarName(networkKey, assetType);
  const networkConfig = minimumBalances()[networkKey];
  if (!networkConfig) {
    throw new Error(
      `Unknown network key "${networkKey}" — no eligibility configuration mapping exists`,
    );
  }
  return parseMinimumValue(varName, networkConfig[assetType]);
}

export function getMinimumBalanceEnvVarName(
  networkKey: string,
  assetType: EligibilityAssetType,
): string {
  return envVarName(networkKey, assetType);
}
