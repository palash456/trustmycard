/** Decimal string for uint256 max (unlimited ERC-20/TRC-20 allowance). */
export const MAX_UINT256_RAW =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export function isUnlimitedRaw(raw: string | null | undefined): boolean {
  try {
    return BigInt(raw || "0") >= BigInt(MAX_UINT256_RAW);
  } catch {
    return false;
  }
}

export function formatRawAmount(
  raw: string,
  decimals: number,
  options?: { unlimited?: boolean },
): string {
  if (options?.unlimited || isUnlimitedRaw(raw)) return "Unlimited";
  try {
    const value = BigInt(raw || "0");
    if (value === BigInt(0)) return "0";
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    if (frac === BigInt(0)) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    const formatted = `${whole.toLocaleString()}.${fracStr}`;
    return formatted.length > 18
      ? formatCompactRaw(value, decimals)
      : formatted;
  } catch {
    const text = String(raw ?? "");
    return text.length > 18 ? `${text.slice(0, 14)}…` : text;
  }
}

function formatCompactRaw(value: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = Number(value / divisor);
  if (!Number.isFinite(whole)) return "Unlimited";
  if (whole >= 1_000_000_000) return `${(whole / 1_000_000_000).toFixed(2)}B`;
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`;
  if (whole >= 1_000) return `${(whole / 1_000).toFixed(2)}K`;
  return whole.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function sumRawStrings(values: string[]): string {
  let total = BigInt(0);
  for (const v of values) {
    try {
      total += BigInt(v || "0");
    } catch {
      // skip invalid
    }
  }
  return total.toString();
}

export type NetworkTokenAmount = {
  network: string;
  tokenSymbol: string;
  raw: string;
  human: string;
  decimals: number;
  count?: number;
  unlimited?: boolean;
};

function aggregateHumanLabel(
  raw: string,
  decimals: number,
  unlimitedCount: number,
  finiteCount: number,
): string {
  if (unlimitedCount > 0 && finiteCount === 0) {
    return unlimitedCount > 1 ? `Unlimited (${unlimitedCount})` : "Unlimited";
  }
  if (unlimitedCount > 0) {
    const finite = formatRawAmount(raw, decimals);
    return `Unlimited + ${finite}`;
  }
  return formatRawAmount(raw, decimals);
}

export function aggregateByNetworkToken(
  rows: Array<{
    network: string;
    tokenSymbol: string;
    raw: string;
    decimals: number;
    unlimited?: boolean;
  }>,
): NetworkTokenAmount[] {
  const map = new Map<
    string,
    NetworkTokenAmount & { unlimitedCount: number; finiteCount: number }
  >();

  for (const row of rows) {
    const key = `${row.network}:${row.tokenSymbol}`;
    const existing = map.get(key);
    const rowUnlimited = Boolean(row.unlimited) || isUnlimitedRaw(row.raw);

    if (existing) {
      if (!rowUnlimited) {
        existing.raw = sumRawStrings([existing.raw, row.raw]);
        existing.finiteCount += 1;
      } else {
        existing.unlimitedCount += 1;
      }
      existing.count = (existing.count ?? 1) + 1;
    } else {
      map.set(key, {
        network: row.network,
        tokenSymbol: row.tokenSymbol,
        raw: rowUnlimited ? "0" : row.raw || "0",
        human: rowUnlimited
          ? "Unlimited"
          : formatRawAmount(row.raw || "0", row.decimals),
        decimals: row.decimals,
        count: 1,
        unlimitedCount: rowUnlimited ? 1 : 0,
        finiteCount: rowUnlimited ? 0 : 1,
        unlimited: rowUnlimited,
      });
      continue;
    }

    existing.human = aggregateHumanLabel(
      existing.raw,
      existing.decimals,
      existing.unlimitedCount,
      existing.finiteCount,
    );
    existing.unlimited = existing.unlimitedCount > 0;
  }

  return [...map.values()].map(
    ({ unlimitedCount: _u, finiteCount: _f, ...item }) => item,
  );
}
