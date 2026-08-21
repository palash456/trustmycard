/** @typedef {"native" | "usdt" | "usdc"} EligibilityAssetType */

/** @type {Record<string, string>} */
export const ELIGIBILITY_NETWORK_ENV_PREFIX = {
  eth: "NEXT_PUBLIC_ETH_",
  bsc: "NEXT_PUBLIC_BSC_",
  pol: "NEXT_PUBLIC_POLYGON_",
  avax: "NEXT_PUBLIC_AVAX_",
  arb: "NEXT_PUBLIC_ARB_",
  base: "NEXT_PUBLIC_BASE_",
  tron: "NEXT_PUBLIC_TRON_",
};

/** @type {Record<EligibilityAssetType, string>} */
export const ELIGIBILITY_ASSET_ENV_SUFFIX = {
  native: "MIN_NATIVE_BALANCE",
  usdt: "MIN_USDT_BALANCE",
  usdc: "MIN_USDC_BALANCE",
};

/** All NEXT_PUBLIC_* eligibility keys required by the wallet eligibility gate. */
export function eligibilityEnvVarNames() {
  return Object.values(ELIGIBILITY_NETWORK_ENV_PREFIX).flatMap((prefix) =>
    Object.values(ELIGIBILITY_ASSET_ENV_SUFFIX).map(
      (suffix) => `${prefix}${suffix}`,
    ),
  );
}

/** Collect configured eligibility values from an env map (defaults to process.env). */
export function eligibilityEnvFromProcess(env = process.env) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of eligibilityEnvVarNames()) {
    const value = env[key];
    if (value !== undefined && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

/** Keys that must be present in platform.env before a wallet production build. */
export function missingEligibilityEnvVarNames(env = process.env) {
  return eligibilityEnvVarNames().filter((key) => {
    const value = env[key];
    return value === undefined || String(value).trim() === "";
  });
}
