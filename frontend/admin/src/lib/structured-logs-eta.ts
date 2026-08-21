const STORAGE_KEY = "tmc:structured-logs-fetch-samples";
const MAX_SAMPLES = 16;

export type StructuredLogsFetchSample = {
  durationMs: number;
  pageSize: number;
  rangeId: string;
  at: number;
};

function readSamples(): StructuredLogsFetchSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StructuredLogsFetchSample[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

function writeSamples(samples: StructuredLogsFetchSample[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(samples.slice(-MAX_SAMPLES)),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Record a completed structured-logs API round-trip. */
export function recordStructuredLogsFetchSample(
  durationMs: number,
  pageSize: number,
  rangeId: string,
) {
  const samples = readSamples();
  samples.push({ durationMs, pageSize, rangeId, at: Date.now() });
  writeSamples(samples);
}

/** Baseline fetch duration before any session samples exist (SSR-safe). */
export function defaultStructuredLogsFetchMs(
  pageSize: number,
  rangeId: string,
): number {
  const rangeFactor =
    rangeId === "15m"
      ? 1
      : rangeId === "1h"
        ? 1.15
        : rangeId === "6h"
          ? 1.35
          : rangeId === "24h"
            ? 1.6
            : rangeId === "7d"
              ? 2
              : 1.25;
  return Math.round((700 + pageSize * 14) * rangeFactor);
}

/** Predict how long one page fetch should take (ms), learned from recent loads. */
export function predictStructuredLogsFetchMs(
  pageSize: number,
  rangeId: string,
): number {
  const samples = readSamples();
  const matching = samples.filter((s) => s.rangeId === rangeId);
  const pool = matching.length >= 2 ? matching : samples;

  if (pool.length === 0) {
    return defaultStructuredLogsFetchMs(pageSize, rangeId);
  }

  const recent = pool.slice(-6);
  const weighted = recent.reduce(
    (acc, sample, index) => {
      const weight = index + 1;
      const perRow = sample.durationMs / Math.max(sample.pageSize, 1);
      return {
        weightSum: acc.weightSum + weight,
        total: acc.total + perRow * weight,
      };
    },
    { weightSum: 0, total: 0 },
  );

  const perRowMs = weighted.total / Math.max(weighted.weightSum, 1);
  return Math.round(perRowMs * pageSize + 80);
}

export function formatEtaSeconds(remainingMs: number): string {
  if (remainingMs <= 500) return "0s";
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function hasStructuredLogsSamples(rangeId?: string): boolean {
  const samples = readSamples();
  if (!rangeId) return samples.length > 0;
  return samples.some((s) => s.rangeId === rangeId);
}
