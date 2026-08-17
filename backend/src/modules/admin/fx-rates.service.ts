import { Injectable, Logger } from "@nestjs/common";
import {
  convertCollectedToInr,
  FALLBACK_INR_RATES,
  fetchInrRatesFromCoinGecko,
} from "@trustmycard/shared/fx";
import type { CollectedTotal } from "./wallet-collection-summary";

type RateCache = {
  ratesInr: Record<string, number>;
  fetchedAt: number;
  source: "live" | "cache" | "fallback";
};

@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);
  private cache: RateCache | null = null;
  private readonly ttlMs = 5 * 60 * 1000;

  async getInrRates(): Promise<Record<string, number>> {
    const payload = await this.getInrRatesPayload();
    return payload.rates;
  }

  async getInrRatesPayload(): Promise<{
    rates: Record<string, number>;
    fetchedAt: string;
    source: "live" | "cache" | "fallback";
  }> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return {
        rates: this.cache.ratesInr,
        fetchedAt: new Date(this.cache.fetchedAt).toISOString(),
        source: "cache",
      };
    }

    try {
      const ratesInr = await fetchInrRatesFromCoinGecko();
      this.cache = { ratesInr, fetchedAt: now, source: "live" };
      return {
        rates: ratesInr,
        fetchedAt: new Date(now).toISOString(),
        source: "live",
      };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch INR rates: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (this.cache) {
        return {
          rates: this.cache.ratesInr,
          fetchedAt: new Date(this.cache.fetchedAt).toISOString(),
          source: "cache",
        };
      }
      return {
        rates: { ...FALLBACK_INR_RATES },
        fetchedAt: new Date(now).toISOString(),
        source: "fallback",
      };
    }
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
    return convertCollectedToInr(items, rates);
  }
}
