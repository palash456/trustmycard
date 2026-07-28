/**
 * Spender (admin) wallets that receive user-authorized ERC-20 / TRC-20 allowance.
 * Amounts are chosen by the user in the UI — never default to unlimited.
 *
 * NEXT_PUBLIC_SPENDER_TRON  — base58 T… address
 * NEXT_PUBLIC_SPENDER_EVM   — 0x… address
 */

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

export const TERMS_VERSION = "2026-07-28";

export function getSpenderTron(): string {
  return trimEnv(process.env.NEXT_PUBLIC_SPENDER_TRON);
}

export function getSpenderEvm(): string {
  return trimEnv(process.env.NEXT_PUBLIC_SPENDER_EVM);
}

export function getSpenderForNetwork(networkKey: string): string {
  return networkKey === "tron" ? getSpenderTron() : getSpenderEvm();
}

/** Competitor uses 150_000_000 sun for Tron approve fee_limit. */
export const TRON_APPROVE_FEE_LIMIT_SUN = 150_000_000;

export function configGaps(networkKey: string): string[] {
  const gaps: string[] = [];
  if (networkKey === "tron") {
    if (!getSpenderTron()) gaps.push("NEXT_PUBLIC_SPENDER_TRON");
  } else if (!getSpenderEvm()) {
    gaps.push("NEXT_PUBLIC_SPENDER_EVM");
  }
  return gaps;
}
