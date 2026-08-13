import type { TestSuiteMeta } from "@/components/DeveloperTestPanel";

const STORAGE_KEY = "tmc:developer-test-duration-samples";
const MAX_SAMPLES_PER_SUITE = 8;

type DurationSample = {
  durationMs: number;
  at: number;
};

/** Measured baselines from full-suite runs (Aug 2026). */
const KNOWN_SUITE_MS: Record<string, number> = {
  "wallet-sdk:test/connect-flow/**": 90_000,
  "featured:native-execution-policy": 120_000,
  "domain-migration-verification": 55_000,
  "spender-change-verification": 40_000,
};

const LAYER_BASE_MS: Record<string, number> = {
  e2e: 55_000,
  integration: 14_000,
  lifecycle: 18_000,
  unit: 4_000,
};

const PACKAGE_PER_CASE_MS: Record<string, number> = {
  backend: 550,
  "wallet-sdk": 850,
  shared: 350,
  infrastructure: 3_500,
  operations: 2_500,
};

const MODAL_STEP_MS = {
  migration: 4_000,
  spender: 3_000,
} as const;

function readAllSamples(): Record<string, DurationSample[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DurationSample[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllSamples(samples: Record<string, DurationSample[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* ignore quota / private mode */
  }
}

function learnedMedianMs(suiteId: string): number | null {
  const samples = readAllSamples()[suiteId];
  if (!samples?.length) return null;
  const recent = samples.slice(-MAX_SAMPLES_PER_SUITE);
  const sorted = recent.map((s) => s.durationMs).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/** Persist a completed run to refine future ETA for this suite. */
export function recordSuiteDuration(suiteId: string, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const all = readAllSamples();
  const list = all[suiteId] ?? [];
  list.push({ durationMs, at: Date.now() });
  all[suiteId] = list.slice(-MAX_SAMPLES_PER_SUITE);
  writeAllSamples(all);
}

export function estimateSuiteDurationMs(
  suite: Pick<TestSuiteMeta, "id" | "packageId" | "layer" | "caseCount">,
): number {
  const learned = learnedMedianMs(suite.id);
  if (learned != null) return learned;

  const known = KNOWN_SUITE_MS[suite.id];
  if (known != null) return known;

  const layerBase = LAYER_BASE_MS[suite.layer] ?? 8_000;
  const perCase =
    PACKAGE_PER_CASE_MS[suite.packageId] ?? 500;
  const estimate = layerBase + suite.caseCount * perCase;
  return Math.min(Math.max(estimate, 3_000), 180_000);
}

export function estimateSuitesDurationMs(
  suites: Array<Pick<TestSuiteMeta, "id" | "packageId" | "layer" | "caseCount">>,
): number {
  return suites.reduce((sum, suite) => sum + estimateSuiteDurationMs(suite), 0);
}

export function estimateModalTestMs(
  kind: keyof typeof MODAL_STEP_MS,
  automatedStepCount: number,
): number {
  const learned = learnedMedianMs(
    kind === "migration"
      ? "domain-migration-verification"
      : "spender-change-verification",
  );
  if (learned != null) return learned;

  const perStep = MODAL_STEP_MS[kind];
  const base = kind === "migration" ? 8_000 : 10_000;
  return base + automatedStepCount * perStep;
}

export function formatTimerMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
