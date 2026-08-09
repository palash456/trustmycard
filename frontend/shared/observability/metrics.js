function labelsKey(labels) {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String(labels[k])}`)
    .join(",");
}
function metricKey(name, labels) {
  return `${name}|${labelsKey(labels)}`;
}
export class MetricRegistry {
  constructor() {
    this.counters = new Map();
    this.histograms = new Map();
    this.gauges = new Map();
  }
  increment(name, labels = {}, delta = 1) {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + delta);
  }
  observe(name, value, labels = {}) {
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
  setGauge(name, value, labels = {}) {
    const key = metricKey(name, labels);
    this.gauges.set(key, value);
  }
  snapshot() {
    const counters = [];
    for (const [key, value] of this.counters) {
      const parsed = this.parseKey(key);
      if (parsed) counters.push({ ...parsed, value });
    }
    const histograms = [];
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
    const gauges = [];
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
  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
  parseKey(key) {
    const pipe = key.indexOf("|");
    if (pipe === -1) return { name: key, labels: {} };
    const name = key.slice(0, pipe);
    const labelStr = key.slice(pipe + 1);
    if (!labelStr) return { name, labels: {} };
    const labels = {};
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
export function incrementCounter(name, labels = {}, delta = 1) {
  try {
    globalMetrics.increment(name, labels, delta);
  } catch {
    /* fail-open */
  }
}
export function recordTiming(name, durationMs, labels = {}) {
  try {
    globalMetrics.observe(name, durationMs, labels);
  } catch {
    /* fail-open */
  }
}
export function formatPrometheusText(snapshot) {
  const lines = [];
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
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_:]/g, "_");
}
function formatLabels(labels) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([k, v]) => `${k}="${String(v)}"`).join(",")}}`;
}
