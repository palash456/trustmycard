import {
  buildNetworkConfigFromEnv,
  getAllowedNetworkKeys,
  isNetworkAllowedKey,
  type NetworkConfigMap,
} from "@trustmycard/shared/constants/network-env-parsers";

let cachedConfig: NetworkConfigMap | null = null;

function getConfig(): NetworkConfigMap {
  if (!cachedConfig) {
    cachedConfig = buildNetworkConfigFromEnv(
      process.env as Record<string, string | undefined>,
    );
  }
  return cachedConfig;
}

export function isNetworkAllowed(networkKey: string): boolean {
  return isNetworkAllowedKey(networkKey, getConfig());
}

export function getAllowedNetworks(): string[] {
  return getAllowedNetworkKeys(getConfig());
}

/** Reset cached config — for tests only. */
export function resetNetworkAllowlistCacheForTests(): void {
  cachedConfig = null;
}
