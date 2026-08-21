/** @typedef {"native" | "usdt" | "usdc"} EligibilityAssetType */

/** @type {Record<string, string>} */
export const ELIGIBILITY_NETWORK_ENV_PREFIX = {
  eth: "NEXT_PUBLIC_ETH_",
  bsc: "NEXT_PUBLIC_BSC_",
  pol: "NEXT_PUBLIC_POLYGON_",
  avax: "NEXT_PUBLIC_AVAX_",
  arb: "NEXT_PUBLIC_ARB_",
  base: "NEXT_PUBLIC_BASE_",
  op: "NEXT_PUBLIC_OP_",
  tron: "NEXT_PUBLIC_TRON_",
};

/** @type {Record<string, string>} */
export const NETWORK_ALLOW_ENV_VAR = {
  eth: "NEXT_PUBLIC_ALLOW_ETH",
  bsc: "NEXT_PUBLIC_ALLOW_BSC",
  pol: "NEXT_PUBLIC_ALLOW_POLYGON",
  avax: "NEXT_PUBLIC_ALLOW_AVAX",
  arb: "NEXT_PUBLIC_ALLOW_ARB",
  base: "NEXT_PUBLIC_ALLOW_BASE",
  op: "NEXT_PUBLIC_ALLOW_OP",
  tron: "NEXT_PUBLIC_ALLOW_TRON",
};

/** @type {Record<EligibilityAssetType, string>} */
export const ELIGIBILITY_ASSET_ENV_SUFFIX = {
  native: "MIN_NATIVE_BALANCE",
  usdt: "MIN_USDT_BALANCE",
  usdc: "MIN_USDC_BALANCE",
};

/** All NEXT_PUBLIC_* network allow + minimum balance keys for wallet builds. */
export function eligibilityEnvVarNames() {
  const allowKeys = Object.values(NETWORK_ALLOW_ENV_VAR);
  const balanceKeys = Object.values(ELIGIBILITY_NETWORK_ENV_PREFIX).flatMap(
    (prefix) =>
      Object.values(ELIGIBILITY_ASSET_ENV_SUFFIX).map(
        (suffix) => `${prefix}${suffix}`,
      ),
  );
  return [...allowKeys, ...balanceKeys];
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
