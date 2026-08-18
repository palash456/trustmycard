"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CollectedAmountLike } from "@trustmycard/shared/fx";
import {
  convertCollectedToInr,
  FALLBACK_INR_RATES,
} from "@trustmycard/shared/fx";

type InrRatesContextValue = {
  rates: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const InrRatesContext = createContext<InrRatesContextValue | null>(null);

export function InrRatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fx-rates/inr", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load INR rates (${res.status})`);
      }
      const data = (await res.json()) as { rates?: Record<string, number> };
      setRates(
        data.rates && Object.keys(data.rates).length > 0
          ? data.rates
          : { ...FALLBACK_INR_RATES },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load INR rates");
      setRates((prev) => prev ?? { ...FALLBACK_INR_RATES });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ rates, loading, error, refresh }),
    [rates, loading, error, refresh],
  );

  return (
    <InrRatesContext.Provider value={value}>
      {children}
    </InrRatesContext.Provider>
  );
}

export function useInrRates() {
  const ctx = useContext(InrRatesContext);
  if (!ctx) {
    throw new Error("useInrRates must be used within InrRatesProvider");
  }
  return ctx;
}

export function useCollectedInr(
  items: CollectedAmountLike[],
  fallback?: number | null,
) {
  const { rates } = useInrRates();
  return useMemo(() => {
    if (!rates) return fallback ?? null;
    return convertCollectedToInr(items, rates);
  }, [items, rates, fallback]);
}
