/** Sentinel stored in AppSettings when collector runs are unlimited. */
export const COLLECTOR_MAX_RUNS_UNLIMITED = "unlimited" as const;

export type CollectorMaxRuns = number | null;

const UNLIMITED_ALIASES = new Set([
  "",
  "unlimited",
  "0",
  "-1",
  "inf",
  "infinity",
  "none",
]);

/**
 * Parse COLLECTOR_MAX_RUNS / collector.maxRuns.
 * Returns null for unlimited; otherwise a positive integer.
 */
export function parseCollectorMaxRuns(
  raw: string | number | null | undefined,
): CollectorMaxRuns {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1) return null;
    return Math.floor(raw);
  }
  const normalized = String(raw).trim().toLowerCase();
  if (UNLIMITED_ALIASES.has(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}

/** Validate explicit env/admin input; throws on invalid non-empty values. */
export function assertValidCollectorMaxRunsInput(
  raw: string | number | null | undefined,
  label = "COLLECTOR_MAX_RUNS",
): CollectorMaxRuns {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1) {
      throw new Error(`${label} must be a positive integer or "unlimited"`);
    }
    return Math.floor(raw);
  }
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized || UNLIMITED_ALIASES.has(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer or "unlimited"`);
  }
  return Math.floor(parsed);
}

export function isCollectorRunLimitReached(
  runCount: number,
  maxRuns: CollectorMaxRuns,
): boolean {
  if (maxRuns == null) return false;
  return runCount >= maxRuns;
}

export function canClaimCollectorRun(
  runCount: number,
  maxRuns: CollectorMaxRuns,
): boolean {
  if (maxRuns == null) return true;
  return runCount < maxRuns;
}

export function formatCollectorMaxRuns(maxRuns: CollectorMaxRuns): string {
  return maxRuns == null ? COLLECTOR_MAX_RUNS_UNLIMITED : String(maxRuns);
}

export const COLLECTOR_RUN_LIMIT_REASON = "COLLECTOR_MAX_RUNS_REACHED" as const;
