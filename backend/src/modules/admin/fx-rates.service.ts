import { Injectable, Logger } from "@nestjs/common";
import type { CollectedTotal } from "./wallet-collection-summary";

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

const FALLBACK_INR_RATES: Record<string, number> = {
  USDT: 83.5,
  USDC: 83.5,
  ETH: 220_000,
  BNB: 45_000,
  MATIC: 35,
  POL: 35,
  TRX: 12,
  AVAX: 2_800,
};

type RateCache = {
  ratesInr: Record<string, number>;
  fetchedAt: number;
};

@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);
  private cache: RateCache | null = null;
  private readonly ttlMs = 5 * 60 * 1000;

  async getInrRates(): Promise<Record<string, number>> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return this.cache.ratesInr;
    }

    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr`;

    try {
      const res = await fetch(url, {
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
      this.cache = { ratesInr, fetchedAt: now };
      return ratesInr;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch INR rates: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.cache?.ratesInr ?? { ...FALLBACK_INR_RATES };
    }
  }

  resolveTokenSymbol(tokenSymbol: string, network: string): string {
    const upper = tokenSymbol.trim().toUpperCase();
    if (upper === "NATIVE") {
      return NETWORK_NATIVE_SYMBOL[network.toLowerCase()] ?? "ETH";
    }
    return upper;
  }

  async convertCollectedToInr(items: CollectedTotal[]): Promise<number | null> {
    if (items.length === 0) return null;
    const rates = await this.getInrRates();
    return this.convertWithRates(items, rates);
  }

  convertWithRates(
    items: CollectedTotal[],
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
      const symbol = this.resolveTokenSymbol(item.tokenSymbol, item.network);
      const rate = effectiveRates[symbol];
      if (!rate) continue;
      total += amount * rate;
      priced += 1;
    }

    return priced > 0 ? total : null;
  }
}
