function inferChainName(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("tron")) return "Tron";
  if (normalized.includes("bnb") || normalized.includes("binance"))
    return "BNB Chain";
  if (normalized.includes("polygon") || normalized.includes("matic"))
    return "Polygon";
  if (normalized.includes("solana")) return "Solana";
  if (normalized.includes("arbitrum")) return "Arbitrum";
  if (normalized.includes("optimism") || /\bop mainnet\b/.test(normalized))
    return "OP Mainnet";
  if (normalized.includes("base")) return "Base";
  if (normalized.includes("avalanche") || normalized.includes("avax"))
    return "Avalanche";
  if (normalized.includes("ethereum") || normalized.includes("eth"))
    return "Ethereum";
  return "the current chain";
}

/** Human-readable pipeline error for admin UI (avoid raw JSON blobs). */
export function formatPipelineErrorMessage(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const gasMatch = text.match(
    /gas required exceeds allowance|insufficient funds for intrinsic transaction cost|insufficient funds for transfer|INSUFFICIENT_FUNDS/i,
  );
  if (gasMatch) {
    const chain = inferChainName(text);
    return `Collector wallet has insufficient native gas for transferFrom on ${chain}.`;
  }

  const unpredictable = text.match(
    /UNPREDICTABLE_GAS_LIMIT|cannot estimate gas/i,
  );
  if (unpredictable) {
    const chain = inferChainName(text);
    return `Background collection could not estimate gas (collector may need native funds on ${chain}).`;
  }

  if (text.startsWith("{") || text.includes('"reason"')) {
    try {
      const parsed = JSON.parse(text) as { reason?: string; message?: string };
      const inner = parsed.reason ?? parsed.message;
      if (inner) return formatPipelineErrorMessage(inner) ?? inner;
    } catch {
      const reason = text.match(/"reason"\s*:\s*"([^"]+)"/)?.[1];
      if (reason) return formatPipelineErrorMessage(reason) ?? reason;
    }
  }

  if (text.length > 220) {
    return `${text.slice(0, 217)}…`;
  }

  return text;
}
