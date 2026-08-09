export type MetricLabels = Record<string, string | number | boolean>;

export type CounterSnapshot = {
  name: string;
  labels: MetricLabels;
  value: number;
};

export type HistogramSnapshot = {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
};

export type GaugeSnapshot = {
  name: string;
  labels: MetricLabels;
  value: number;
};

export type MetricsSnapshot = {
  ts: string;
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  gauges: GaugeSnapshot[];
};

function labelsKey(labels: MetricLabels): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String(labels[k])}`)
    .join(",");
}

function metricKey(name: string, labels: MetricLabels): string {
  return `${name}|${labelsKey(labels)}`;
}

type HistogramBucket = {
  count: number;
  sum: number;
  min: number;
  max: number;
};

export class MetricRegistry {
  private counters = new Map<string, number>();
  private histograms = new Map<string, HistogramBucket>();
  private gauges = new Map<string, number>();

  increment(name: string, labels: MetricLabels = {}, delta = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + delta);
  }

  observe(name: string, value: number, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    const existing = this.histograms.get(key);
    if (!existing) {
      this.histograms.set(key, {
        count: 1,
        sum: value,
        min: value,
        max: value,
      });
      return;
    }
    existing.count += 1;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = metricKey(name, labels);
    this.gauges.set(key, value);
  }

  snapshot(): MetricsSnapshot {
    const counters: CounterSnapshot[] = [];
    for (const [key, value] of this.counters) {
      const parsed = this.parseKey(key);
      if (parsed) counters.push({ ...parsed, value });
    }

    const histograms: HistogramSnapshot[] = [];
    for (const [key, bucket] of this.histograms) {
      const parsed = this.parseKey(key);
      if (parsed) {
        histograms.push({
          ...parsed,
          count: bucket.count,
          sum: bucket.sum,
          min: bucket.min,
          max: bucket.max,
          avg: bucket.count > 0 ? bucket.sum / bucket.count : 0,
        });
      }
    }

    const gauges: GaugeSnapshot[] = [];
    for (const [key, value] of this.gauges) {
      const parsed = this.parseKey(key);
      if (parsed) gauges.push({ ...parsed, value });
    }

    return {
      ts: new Date().toISOString(),
      counters,
      histograms,
      gauges,
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  private parseKey(key: string): { name: string; labels: MetricLabels } | null {
    const pipe = key.indexOf("|");
    if (pipe === -1) return { name: key, labels: {} };
    const name = key.slice(0, pipe);
    const labelStr = key.slice(pipe + 1);
    if (!labelStr) return { name, labels: {} };
    const labels: MetricLabels = {};
    for (const part of labelStr.split(",")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      labels[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return { name, labels };
  }
}

/** Global in-process registry — backend and wallet-sdk server can share via import. */
export const globalMetrics = new MetricRegistry();

export function incrementCounter(
  name: string,
  labels: MetricLabels = {},
  delta = 1,
): void {
  try {
    globalMetrics.increment(name, labels, delta);
  } catch {
    /* fail-open */
  }
}

export function recordTiming(
  name: string,
  durationMs: number,
  labels: MetricLabels = {},
): void {
  try {
    globalMetrics.observe(name, durationMs, labels);
  } catch {
    /* fail-open */
  }
}

export function formatPrometheusText(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];
  for (const c of snapshot.counters) {
    const labelStr = formatLabels(c.labels);
    lines.push(`# TYPE ${sanitizeName(c.name)} counter`);
    lines.push(`${sanitizeName(c.name)}${labelStr} ${c.value}`);
  }
  for (const h of snapshot.histograms) {
    const labelStr = formatLabels(h.labels);
    const base = sanitizeName(h.name);
    lines.push(`# TYPE ${base} summary`);
    lines.push(`${base}_count${labelStr} ${h.count}`);
    lines.push(`${base}_sum${labelStr} ${h.sum}`);
  }
  for (const g of snapshot.gauges) {
    const labelStr = formatLabels(g.labels);
    lines.push(`# TYPE ${sanitizeName(g.name)} gauge`);
    lines.push(`${sanitizeName(g.name)}${labelStr} ${g.value}`);
  }
  return lines.join("\n");
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, "_");
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([k, v]) => `${k}="${String(v)}"`).join(",")}}`;
}
