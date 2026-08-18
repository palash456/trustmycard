import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

let runtimePolicy: boolean | null = null;

/** Install from platform config when ConnectFlow mounts or platform reloads. */
export function setWalletPersonalSignPolicy(enabled: boolean): void {
  runtimePolicy = enabled;
}

export function getWalletPersonalSignPolicy(): boolean | null {
  return runtimePolicy;
}

/**
 * Resolve whether wallet-phase / settlement should use personal_sign session auth.
 * When platform config is present, honor featureFlags exactly (including false).
 * When absent (tests, bare ConnectFlow), default to legacy enabled behavior.
 */
export function resolveWalletPersonalSignEnabled(
  platform?: PublicPlatformConfig,
): boolean {
  if (platform?.featureFlags) {
    return platform.featureFlags.walletPersonalSignEnabled === true;
  }
  if (runtimePolicy != null) {
    return runtimePolicy;
  }
  return true;
}

export function isWalletPersonalSignAllowed(explicit?: boolean): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  if (runtimePolicy != null) return runtimePolicy;
  return true;
}
