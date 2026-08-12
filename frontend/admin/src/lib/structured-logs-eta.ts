const STORAGE_KEY = "tmc:structured-logs-fetch-samples";
const MAX_SAMPLES = 12;

export type StructuredLogsFetchSample = {
  durationMs: number;
  pageSize: number;
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
) {
  const samples = readSamples();
  samples.push({ durationMs, pageSize, at: Date.now() });
  writeSamples(samples);
}

/** Predict how long one page fetch should take (ms), learned from recent loads. */
export function predictStructuredLogsFetchMs(pageSize: number): number {
  const samples = readSamples();
  if (samples.length === 0) {
    // Cold start: conservative guess scales with page size.
    return Math.round(900 + pageSize * 18);
  }

  const recent = samples.slice(-6);
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
  return Math.round(perRowMs * pageSize + 120);
}

export function formatEtaSeconds(remainingMs: number): string {
  if (remainingMs <= 0) return "0s";
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function hasStructuredLogsSamples(): boolean {
  return readSamples().length > 0;
}
