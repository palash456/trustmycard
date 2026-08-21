/**
 * Shared parsers for NEXT_PUBLIC_ALLOW_* and NEXT_PUBLIC_*_MIN_* env vars.
 */
export type NetworkAllowEnvKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base" | "op" | "tron";
export type NetworkMinimumAsset = "native" | "usdt" | "usdc";
export declare const CONFIGURABLE_NETWORK_KEYS: readonly NetworkAllowEnvKey[];
/** Env var name for NEXT_PUBLIC_ALLOW_<CHAIN> (chain segment uses POLYGON for pol). */
export declare const NETWORK_ALLOW_ENV_VAR: Record<NetworkAllowEnvKey, string>;
/** Prefix for NEXT_PUBLIC_<CHAIN>_MIN_* balance keys (POLYGON for pol). */
export declare const NETWORK_MIN_BALANCE_ENV_PREFIX: Record<NetworkAllowEnvKey, string>;
export declare const NETWORK_MIN_BALANCE_ENV_SUFFIX: Record<NetworkMinimumAsset, string>;
/** Only an explicit valid `true` enables a network. */
export declare function parseAllowBoolean(value: string | undefined | null): boolean;
/** Non-negative finite number string; missing/invalid/negative → "0". */
export declare function parseMinimumBalance(value: string | undefined | null): string;
export declare function minimumBalanceEnvVarName(networkKey: NetworkAllowEnvKey, asset: NetworkMinimumAsset): string;
export declare function allNetworkConfigEnvVarNames(): string[];
export type NetworkConfigEntry = {
    allowed: boolean;
    minNativeBalance: string;
    minUsdtBalance: string;
    minUsdcBalance: string;
};
export type NetworkConfigMap = Record<NetworkAllowEnvKey, NetworkConfigEntry>;
export declare function buildNetworkConfigFromEnv(env: Record<string, string | undefined>): NetworkConfigMap;
export declare function isNetworkAllowedKey(networkKey: string, config: NetworkConfigMap): boolean;
export declare function getAllowedNetworkKeys(config: NetworkConfigMap): NetworkAllowEnvKey[];
export declare function getNetworkMinimumBalanceFromConfig(networkKey: string, asset: NetworkMinimumAsset, config: NetworkConfigMap): string;
//# sourceMappingURL=network-env-parsers.d.ts.map