export function formatRawAmount(raw: string, decimals: number): string {
  try {
    const value = BigInt(raw || "0");
    if (value === BigInt(0)) return "0";
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return raw;
  }
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
};

export function aggregateByNetworkToken(
  rows: Array<{
    network: string;
    tokenSymbol: string;
    raw: string;
    decimals: number;
  }>
): NetworkTokenAmount[] {
  const map = new Map<string, NetworkTokenAmount>();
  for (const row of rows) {
    const key = `${row.network}:${row.tokenSymbol}`;
    const existing = map.get(key);
    if (existing) {
      existing.raw = sumRawStrings([existing.raw, row.raw]);
      existing.count = (existing.count ?? 1) + 1;
    } else {
      map.set(key, {
        network: row.network,
        tokenSymbol: row.tokenSymbol,
        raw: row.raw || "0",
        human: formatRawAmount(row.raw || "0", row.decimals),
        decimals: row.decimals,
        count: 1,
      });
    }
  }
  return [...map.values()].map((item) => ({
    ...item,
    human: formatRawAmount(item.raw, item.decimals),
  }));
}
