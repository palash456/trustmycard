import type {
  CounterSnapshot,
  GaugeSnapshot,
  HistogramSnapshot,
  MetricsSnapshot as ApiMetricsSnapshot,
} from "@trustmycard/shared/observability";

export type NormalizedMetrics = {
  capturedAt: string;
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  gauges: GaugeSnapshot[];
};

function isCounterSnapshot(value: unknown): value is CounterSnapshot {
  return (
    typeof value === "object" &&
    value != null &&
    "name" in value &&
    "value" in value &&
    typeof (value as CounterSnapshot).value === "number"
  );
}

/** Accept real backend snapshot or legacy demo map shape. */
export function normalizeMetricsSnapshot(
  raw: unknown,
): NormalizedMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.counters)) {
    const counters = data.counters.filter(isCounterSnapshot);
    return {
      capturedAt: String(
        data.ts ?? data.capturedAt ?? new Date().toISOString(),
      ),
      counters,
      histograms: Array.isArray(data.histograms)
        ? (data.histograms as HistogramSnapshot[])
        : [],
      gauges: Array.isArray(data.gauges)
        ? (data.gauges as GaugeSnapshot[])
        : [],
    };
  }

  if (data.counters && typeof data.counters === "object") {
    const counters = Object.entries(
      data.counters as Record<string, number>,
    ).map(([name, value]) => ({
      name,
      labels: {},
      value: Number(value) || 0,
    }));
    return {
      capturedAt: String(data.capturedAt ?? new Date().toISOString()),
      counters,
      histograms: [],
      gauges: [],
    };
  }

  return null;
}

export function formatMetricLabels(
  labels: Record<string, string | number | boolean>,
): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([k, v]) => `${k}=${v}`).join(", ")}}`;
}

export function counterTotalByName(
  counters: CounterSnapshot[],
  name: string,
): number {
  return counters
    .filter((c) => c.name === name)
    .reduce((sum, c) => sum + c.value, 0);
}

export type { ApiMetricsSnapshot };
