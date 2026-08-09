import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CompactMetric } from "@/components/analytics/CompactMetric";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  lifetimeCollectionTotal,
  periodCollectionTotal,
} from "@/lib/analytics-present";
import {
  formatMs,
  formatTokenAmounts,
  healthLabel,
} from "@/lib/analytics-format";
import type { AnalyticsResponse } from "@/types/analytics";

export function AnalyticsExecutiveSummary({
  data,
}: {
  data: AnalyticsResponse;
}) {
  const lifetimeTotal = lifetimeCollectionTotal(data);
  const periodTotal = periodCollectionTotal(data);
  const health = data.health.overallHealth;
  const healthAccent =
    health === "critical"
      ? "danger"
      : health === "warning"
        ? "warning"
        : "success";

  return (
    <div className="space-y-4 pb-2">
      <Card className="border-0 bg-gradient-to-br from-card via-card to-muted/20">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-brand text-lg">
                Executive snapshot
              </CardTitle>
              <CardDescription>
                Key outcomes for{" "}
                {data.period.preset === "custom"
                  ? "selected range"
                  : data.period.preset.replace(/([a-z])([A-Z])/g, "$1 $2")}
                — revenue is per-token volume, not USD-normalized
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Operations
              </Link>
              <Link
                href="/pipeline"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Pipeline
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <CompactMetric
              label="Period collected"
              value={periodTotal.toLocaleString()}
              hint={`${data.revenue.periodConfirmedCount} confirmed transfers`}
            />
            <CompactMetric
              label="Lifetime collected"
              value={lifetimeTotal.toLocaleString()}
              hint={`${data.revenue.confirmedTransferCount} all-time`}
            />
            <CompactMetric
              label="Active wallets (7d)"
              value={data.users.activeWallets}
              hint={`${data.users.total} total wallets`}
            />
            <CompactMetric
              label="Collection success"
              value={`${data.collections.successRate}%`}
              hint={`${data.collections.total} collections`}
            />
            <CompactMetric
              label="Platform health"
              value={healthLabel(health)}
              accent={healthAccent}
              hint={`${data.health.stuckTransactions} stuck · ${data.health.queueBacklog} queued`}
            />
            <CompactMetric
              label="At risk"
              value={formatTokenAmounts(data.revenue.pending, 1)}
              accent="warning"
              hint={`${formatTokenAmounts(data.revenue.recoverable, 1)} recoverable`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-muted/15 p-4 lg:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Operational pulse
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <CompactMetric
                  label="Failures (period)"
                  value={data.failures.totalFailures}
                  accent={
                    data.failures.totalFailures > 0 ? "danger" : "default"
                  }
                />
                <CompactMetric
                  label="Due for collection"
                  value={data.health.collectorHealth.due}
                  hint={
                    data.health.collectorHealth.enabled
                      ? "Collector on"
                      : "Collector off"
                  }
                />
                <CompactMetric
                  label="Avg lifecycle"
                  value={formatMs(data.performance.averageLifecycleMs)}
                />
                <CompactMetric
                  label="Native funding OK"
                  value={`${data.nativeFunding.successRate}%`}
                  hint={`${data.nativeFunding.total} requests`}
                />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/15 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                User funnel
              </p>
              <div className="mt-3 grid gap-2">
                <CompactMetric
                  label="New (period)"
                  value={data.users.newInPeriod}
                />
                <CompactMetric
                  label="Returning"
                  value={data.users.returningInPeriod}
                />
                <CompactMetric
                  label="Completed pipelines"
                  value={data.users.workflowStages.successfullyCompleted}
                  accent="success"
                />
                <CompactMetric
                  label="Abandoned"
                  value={data.users.abandonedWallets}
                  accent="warning"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
