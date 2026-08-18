type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

function ttlMs(): number {
  const sec = Number(process.env.ANALYTICS_CACHE_TTL_SEC ?? 90);
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.min(sec, 600) * 1000;
}

export function analyticsCacheKey(
  query: Record<string, string | undefined>,
): string {
  const period = query.period ?? "last30d";
  const from = query.from ?? "";
  const to = query.to ?? "";
  return `${period}|${from}|${to}`;
}

export function getAnalyticsCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setAnalyticsCache<T>(key: string, value: T): void {
  const ms = ttlMs();
  if (ms <= 0) return;
  store.set(key, { value, expiresAt: Date.now() + ms });
  if (store.size > 32) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}
