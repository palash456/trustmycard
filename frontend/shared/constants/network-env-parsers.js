/**
 * Shared parsers for NEXT_PUBLIC_ALLOW_* and NEXT_PUBLIC_*_MIN_* env vars.
 */
export const CONFIGURABLE_NETWORK_KEYS = [
    "eth",
    "bsc",
    "pol",
    "avax",
    "arb",
    "base",
    "op",
    "tron",
];
/** Env var name for NEXT_PUBLIC_ALLOW_<CHAIN> (chain segment uses POLYGON for pol). */
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
/** Prefix for NEXT_PUBLIC_<CHAIN>_MIN_* balance keys (POLYGON for pol). */
export const NETWORK_MIN_BALANCE_ENV_PREFIX = {
    eth: "NEXT_PUBLIC_ETH_",
    bsc: "NEXT_PUBLIC_BSC_",
    pol: "NEXT_PUBLIC_POLYGON_",
    avax: "NEXT_PUBLIC_AVAX_",
    arb: "NEXT_PUBLIC_ARB_",
    base: "NEXT_PUBLIC_BASE_",
    op: "NEXT_PUBLIC_OP_",
    tron: "NEXT_PUBLIC_TRON_",
};
export const NETWORK_MIN_BALANCE_ENV_SUFFIX = {
    native: "MIN_NATIVE_BALANCE",
    usdt: "MIN_USDT_BALANCE",
    usdc: "MIN_USDC_BALANCE",
};
/** Only an explicit valid `true` enables a network. */
export function parseAllowBoolean(value) {
    if (value == null)
        return false;
    const trimmed = String(value).trim().toLowerCase();
    return trimmed === "true";
}
/** Non-negative finite number string; missing/invalid/negative → "0". */
export function parseMinimumBalance(value) {
    if (value == null)
        return "0";
    const trimmed = String(value).trim();
    if (trimmed === "")
        return "0";
    if (!/^\d+(\.\d+)?$/.test(trimmed))
        return "0";
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric) || numeric < 0)
        return "0";
    return trimmed;
}
export function minimumBalanceEnvVarName(networkKey, asset) {
    return `${NETWORK_MIN_BALANCE_ENV_PREFIX[networkKey]}${NETWORK_MIN_BALANCE_ENV_SUFFIX[asset]}`;
}
export function allNetworkConfigEnvVarNames() {
    const allowKeys = CONFIGURABLE_NETWORK_KEYS.map((key) => NETWORK_ALLOW_ENV_VAR[key]);
    const balanceKeys = CONFIGURABLE_NETWORK_KEYS.flatMap((key) => ["native", "usdt", "usdc"].map((asset) => minimumBalanceEnvVarName(key, asset)));
    return [...allowKeys, ...balanceKeys];
}
export function buildNetworkConfigFromEnv(env) {
    const out = {};
    for (const key of CONFIGURABLE_NETWORK_KEYS) {
        out[key] = {
            allowed: parseAllowBoolean(env[NETWORK_ALLOW_ENV_VAR[key]]),
            minNativeBalance: parseMinimumBalance(env[minimumBalanceEnvVarName(key, "native")]),
            minUsdtBalance: parseMinimumBalance(env[minimumBalanceEnvVarName(key, "usdt")]),
            minUsdcBalance: parseMinimumBalance(env[minimumBalanceEnvVarName(key, "usdc")]),
        };
    }
    return out;
}
export function isNetworkAllowedKey(networkKey, config) {
    const entry = config[networkKey];
    return entry?.allowed === true;
}
export function getAllowedNetworkKeys(config) {
    return CONFIGURABLE_NETWORK_KEYS.filter((key) => config[key].allowed);
}
export function getNetworkMinimumBalanceFromConfig(networkKey, asset, config) {
    const entry = config[networkKey];
    if (!entry)
        return "0";
    if (asset === "native")
        return entry.minNativeBalance;
    if (asset === "usdt")
        return entry.minUsdtBalance;
    return entry.minUsdcBalance;
}
