import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auditStructuredLink } from "@/lib/log-links";
import {
  counterTotalByName,
  formatMetricLabels,
  normalizeMetricsSnapshot,
} from "@/lib/metrics-present";

export function MetricsPanel({ metrics }: { metrics: unknown }) {
  const normalized = normalizeMetricsSnapshot(metrics);
  if (!normalized) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Runtime metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Metrics snapshot unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { counters, histograms, gauges, capturedAt } = normalized;
  const persistFailures = counterTotalByName(
    counters,
    "observability.persist.failed",
  );
  const displayCounters = counters.slice(0, 12);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Runtime metrics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Snapshot at {capturedAt}
          {persistFailures > 0 ? (
            <>
              {" · "}
              <Link
                href={auditStructuredLink({
                  module: "observability",
                  search: "persist",
                })}
                className="text-destructive hover:underline"
              >
                {persistFailures} persist failure(s)
              </Link>
            </>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayCounters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No counters recorded yet.
          </p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {displayCounters.map((counter) => {
              const labelSuffix = formatMetricLabels(counter.labels);
              const key = `${counter.name}${labelSuffix}-${counter.value}`;
              return (
                <div
                  key={key}
                  className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <dt className="truncate text-[10px] text-muted-foreground">
                    {counter.name}
                    {labelSuffix ? (
                      <span className="text-muted-foreground/80">
                        {" "}
                        {labelSuffix}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {counter.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {histograms.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Histograms
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              {histograms.slice(0, 6).map((h) => (
                <div
                  key={`${h.name}${formatMetricLabels(h.labels)}`}
                  className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <dt className="truncate text-[10px] text-muted-foreground">
                    {h.name}
                    {formatMetricLabels(h.labels)}
                  </dt>
                  <dd className="text-xs tabular-nums">
                    n={h.count} · avg={h.avg.toFixed(1)}ms · max=
                    {h.max.toFixed(0)}ms
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {gauges.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Gauges
            </p>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gauges.slice(0, 6).map((g) => (
                <div
                  key={`${g.name}${formatMetricLabels(g.labels)}`}
                  className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <dt className="truncate text-[10px] text-muted-foreground">
                    {g.name}
                    {formatMetricLabels(g.labels)}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {g.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
