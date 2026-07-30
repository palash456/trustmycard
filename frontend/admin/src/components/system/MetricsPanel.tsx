import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auditStructuredLink } from "@/lib/log-links";
import type { MetricsSnapshot } from "@/lib/observability";

export function MetricsPanel({ metrics }: { metrics: MetricsSnapshot }) {
  const counters = Object.entries(metrics.counters ?? {}).slice(0, 12);
  const persistFailures = metrics.counters?.["observability.persist.failed"] ?? 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Runtime metrics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Snapshot at {metrics.capturedAt}
          {persistFailures > 0 ? (
            <>
              {" · "}
              <Link
                href={auditStructuredLink({ module: "observability", search: "persist" })}
                className="text-destructive hover:underline"
              >
                {persistFailures} persist failure(s)
              </Link>
            </>
          ) : null}
        </p>
      </CardHeader>
      <CardContent>
        {counters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No counters recorded yet.</p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {counters.map(([name, value]) => (
              <div
                key={name}
                className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <dt className="truncate text-[10px] text-muted-foreground">{name}</dt>
                <dd className="text-sm font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
