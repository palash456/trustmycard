import {
  minimumBalanceEnvVarName,
  NETWORK_ALLOW_ENV_VAR,
  NETWORK_MIN_BALANCE_ENV_PREFIX,
  type NetworkAllowEnvKey,
} from "@trustmycard/shared/constants/network-env-parsers";
import type { EligibilityAssetType } from "./types";
import { getNetworkMinimumBalance } from "./network-config";

export function getMinimumBalance(
  networkKey: string,
  assetType: EligibilityAssetType,
): string {
  return getNetworkMinimumBalance(networkKey, assetType);
}

export function getMinimumBalanceEnvVarName(
  networkKey: string,
  assetType: EligibilityAssetType,
): string {
  const key = networkKey as NetworkAllowEnvKey;
  if (!NETWORK_MIN_BALANCE_ENV_PREFIX[key]) {
    throw new Error(
      `Unknown network key "${networkKey}" — no eligibility configuration mapping exists`,
    );
  }
  return minimumBalanceEnvVarName(key, assetType);
}

export function getAllowEnvVarName(networkKey: string): string {
  const key = networkKey as NetworkAllowEnvKey;
  const envVar = NETWORK_ALLOW_ENV_VAR[key];
  if (!envVar) {
    throw new Error(
      `Unknown network key "${networkKey}" — no allow configuration mapping exists`,
    );
  }
  return envVar;
}
