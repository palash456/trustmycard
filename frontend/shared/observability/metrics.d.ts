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
export declare class MetricRegistry {
  private counters;
  private histograms;
  private gauges;
  increment(name: string, labels?: MetricLabels, delta?: number): void;
  observe(name: string, value: number, labels?: MetricLabels): void;
  setGauge(name: string, value: number, labels?: MetricLabels): void;
  snapshot(): MetricsSnapshot;
  reset(): void;
  private parseKey;
}
/** Global in-process registry — backend and wallet-sdk server can share via import. */
export declare const globalMetrics: MetricRegistry;
export declare function incrementCounter(
  name: string,
  labels?: MetricLabels,
  delta?: number,
): void;
export declare function recordTiming(
  name: string,
  durationMs: number,
  labels?: MetricLabels,
): void;
export declare function formatPrometheusText(snapshot: MetricsSnapshot): string;
//# sourceMappingURL=metrics.d.ts.map
