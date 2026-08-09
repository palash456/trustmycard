import Link from "next/link";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnalyticsInsight } from "@/types/analytics";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: XCircle,
} as const;
const STYLES = {
  info: "border-blue-500/25 bg-blue-500/5",
  warning: "border-amber-500/25 bg-amber-500/5",
  critical: "border-destructive/25 bg-destructive/5",
} as const;

export function InsightsPanel({ insights }: { insights: AnalyticsInsight[] }) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="shrink-0 space-y-0 px-4 pb-0 pt-4">
        <CardTitle className="text-[11px] font-medium text-muted-foreground">
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3">
        {insights.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No insights for this period.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((insight, i) => {
              const Icon = ICONS[insight.severity];
              const body = (
                <div
                  className={cn(
                    "rounded-md border p-2.5",
                    STYLES[insight.severity],
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-3 shrink-0 opacity-80" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium">{insight.title}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                        {insight.body}
                      </p>
                      {insight.metric ? (
                        <p className="mt-1 text-xs font-semibold tabular-nums">
                          {insight.metric}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
              return insight.href ? (
                <Link
                  key={i}
                  href={insight.href}
                  className="block hover:opacity-90"
                >
                  {body}
                </Link>
              ) : (
                <div key={i}>{body}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
