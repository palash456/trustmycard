import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

/** @deprecated Prefer platform config from backend API. */
export const TERMS_VERSION = "2026-07-28";

/** @deprecated Prefer platform config from backend API. */
export const TRON_APPROVE_FEE_LIMIT_SUN = 150_000_000;

export function getSpenderTron(platform?: PublicPlatformConfig): string {
  return (platform?.wallets.spenderTron ?? "").trim();
}

export function getSpenderEvm(platform?: PublicPlatformConfig): string {
  return (platform?.wallets.spenderEvm ?? "").trim();
}

export function getSpenderForNetwork(
  networkKey: string,
  platform?: PublicPlatformConfig
): string {
  return networkKey === "tron"
    ? getSpenderTron(platform)
    : getSpenderEvm(platform);
}

export function termsVersion(platform?: PublicPlatformConfig): string {
  return platform?.approval.termsVersion ?? TERMS_VERSION;
}

export function tronApproveFeeLimitSun(platform?: PublicPlatformConfig): number {
  return platform?.approval.tronApproveFeeLimitSun ?? TRON_APPROVE_FEE_LIMIT_SUN;
}

export function configGaps(
  networkKey: string,
  platform?: PublicPlatformConfig
): string[] {
  const gaps: string[] = [];
  if (networkKey === "tron") {
    if (!getSpenderTron(platform)) gaps.push("platform.wallets.spenderTron");
  } else if (!getSpenderEvm(platform)) {
    gaps.push("platform.wallets.spenderEvm");
  }
  return gaps;
}
