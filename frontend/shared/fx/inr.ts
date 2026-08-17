export type CollectedAmountLike = {
  network: string;
  tokenSymbol: string;
  collectedHuman?: string;
  collectedRaw?: string;
  decimals?: number;
};

const COINGECKO_IDS: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin",
  ETH: "ethereum",
  BNB: "binancecoin",
  MATIC: "matic-network",
  POL: "matic-network",
  TRX: "tron",
  AVAX: "avalanche-2",
  NATIVE: "ethereum",
};

const NETWORK_NATIVE_SYMBOL: Record<string, string> = {
  eth: "ETH",
  bsc: "BNB",
  pol: "POL",
  arb: "ETH",
  base: "ETH",
  tron: "TRX",
  avax: "AVAX",
};

/** Approximate INR rates used only when live fetch is unavailable. */
export const FALLBACK_INR_RATES: Record<string, number> = {
  USDT: 83.5,
  USDC: 83.5,
  ETH: 180_000,
  BNB: 45_000,
  MATIC: 35,
  POL: 35,
  TRX: 12,
  AVAX: 2_800,
};

export function resolveTokenSymbol(tokenSymbol: string, network: string): string {
  const upper = tokenSymbol.trim().toUpperCase();
  if (upper === "NATIVE") {
    return NETWORK_NATIVE_SYMBOL[network.toLowerCase()] ?? "ETH";
  }
  return upper;
}

export function convertCollectedToInr(
  items: CollectedAmountLike[],
  rates: Record<string, number>,
): number | null {
  if (items.length === 0) return null;

  const effectiveRates =
    Object.keys(rates).length > 0 ? rates : FALLBACK_INR_RATES;

  let total = 0;
  let priced = 0;

  for (const item of items) {
    const amount = Number.parseFloat(item.collectedHuman ?? "0");
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const symbol = resolveTokenSymbol(item.tokenSymbol, item.network);
    const rate = effectiveRates[symbol];
    if (!rate || !Number.isFinite(rate) || rate <= 0) continue;
    total += amount * rate;
    priced += 1;
  }

  return priced > 0 ? total : null;
}

export function formatInrValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function fetchInrRatesFromCoinGecko(
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr`;

  const res = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`CoinGecko responded ${res.status}`);
  }

  const data = (await res.json()) as Record<string, { inr?: number }>;
  const ratesInr: Record<string, number> = {};
  for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
    const rate = data[geckoId]?.inr;
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      ratesInr[symbol] = rate;
    }
  }

  if (Object.keys(ratesInr).length === 0) {
    throw new Error("CoinGecko returned no INR rates");
  }

  return ratesInr;
}
