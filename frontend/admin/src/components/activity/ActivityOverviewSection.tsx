import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActivityTab } from "@/components/activity/ActivityTabsNav";
import type { UnifiedActivityItem } from "@/types/activity-feed";

const TAB_LABELS: Record<ActivityTab, string> = {
  all: "User journeys",
  connections: "Connect & scan",
  flow: "Authorization steps",
  user: "Payments",
  errors: "Failed steps",
  sessions: "Session summaries",
};

function topSteps(
  items: UnifiedActivityItem[],
  limit = 5
): Array<{ step: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.step, (counts.get(item.step) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function isErrorItem(item: UnifiedActivityItem): boolean {
  return Boolean(
    item.error ||
      item.status === "error" ||
      item.status === "failed" ||
      item.status === "failure"
  );
}

export function ActivityOverviewSection({
  tab,
  total,
  items,
}: {
  tab: ActivityTab;
  total: number;
  items: UnifiedActivityItem[];
}) {
  const pageCount = items.length;
  const successCount = items.filter(
    (e) => e.status === "success" || e.status === "completed"
  ).length;
  const errorCount =
    tab === "errors" ? total : items.filter(isErrorItem).length;
  const successRate =
    pageCount > 0 ? Math.round((successCount / pageCount) * 100) : null;
  const uniqueWallets = new Set(items.map((e) => e.address)).size;
  const steps = topSteps(items);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Journey events" value={total} sub={TAB_LABELS[tab]} />
        <StatCard
          label="Success rate"
          value={successRate != null ? `${successRate}%` : "—"}
          sub={`${successCount} succeeded on this page`}
        />
        <StatCard
          label="Errors"
          value={errorCount}
          sub={tab === "errors" ? "Total matching filter" : "On this page"}
          className={errorCount > 0 ? "ring-1 ring-destructive/20" : undefined}
        />
        <StatCard
          label="Unique wallets"
          value={uniqueWallets}
          sub={pageCount > 0 ? "On this page" : "No rows loaded"}
        />
      </div>

      {steps.length > 0 ? (
        <Card className="border-0">
          <CardHeader className="pb-3">
            <CardTitle className="font-brand text-base">Steps on this page</CardTitle>
            <CardDescription>Journey stages from scan to payment</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {steps.map(({ step, count }) => (
              <Badge key={step} variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                <span className="font-medium">{step}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
