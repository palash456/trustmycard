/**
 * Approve / allowance placeholders.
 * Fill these in `.env.local` before production use.
 *
 * NEXT_PUBLIC_SPENDER_TRON  — base58 T… address that receives TRC-20 allowance
 * NEXT_PUBLIC_SPENDER_EVM   — 0x… address that receives ERC-20 allowance
 * NEXT_PUBLIC_APPROVE_AMOUNT_USDT — human amount (e.g. "100") or "MAX" for uint256 max
 */

export type AllowancePolicy =
  | { mode: "unset" }
  | { mode: "max" }
  | { mode: "exact"; humanAmount: string };

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

export function getSpenderTron(): string {
  // PLACEHOLDER — set NEXT_PUBLIC_SPENDER_TRON in .env.local
  return trimEnv(process.env.NEXT_PUBLIC_SPENDER_TRON);
}

export function getSpenderEvm(): string {
  // PLACEHOLDER — set NEXT_PUBLIC_SPENDER_EVM in .env.local
  return trimEnv(process.env.NEXT_PUBLIC_SPENDER_EVM);
}

export function getAllowancePolicy(): AllowancePolicy {
  // PLACEHOLDER — set NEXT_PUBLIC_APPROVE_AMOUNT_USDT in .env.local
  const raw = trimEnv(process.env.NEXT_PUBLIC_APPROVE_AMOUNT_USDT);
  if (!raw) return { mode: "unset" };
  if (/^max$/i.test(raw)) return { mode: "max" };
  return { mode: "exact", humanAmount: raw };
}

/** Competitor uses 150_000_000 sun for Tron approve fee_limit. */
export const TRON_APPROVE_FEE_LIMIT_SUN = 150_000_000;

export function configGaps(networkKey: string): string[] {
  const gaps: string[] = [];
  const policy = getAllowancePolicy();
  if (policy.mode === "unset") {
    gaps.push("NEXT_PUBLIC_APPROVE_AMOUNT_USDT");
  }
  if (networkKey === "tron") {
    if (!getSpenderTron()) gaps.push("NEXT_PUBLIC_SPENDER_TRON");
  } else if (!getSpenderEvm()) {
    gaps.push("NEXT_PUBLIC_SPENDER_EVM");
  }
  return gaps;
}
