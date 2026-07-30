import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auditStructuredLink } from "@/lib/log-links";
import type { ActivityTab } from "@/components/activity/ActivityTabsNav";
import { formatActivityError } from "@/components/activity/ActivityErrorCell";

type ActivityItem = {
  type: string;
  status: string;
  error: unknown;
  address: string;
};

const TAB_LABELS: Record<ActivityTab, string> = {
  flow: "All flow events",
  user: "User actions",
  errors: "Errors only",
  sessions: "Session timelines",
  connections: "Wallet connections",
};

function topTypes(items: ActivityItem[], limit = 4): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function ActivityOverviewSection({
  tab,
  total,
  items,
  sessionTotal,
}: {
  tab: ActivityTab;
  total: number;
  items: ActivityItem[];
  sessionTotal?: number;
}) {
  const isSessions = tab === "sessions";
  const pageCount = items.length;
  const successCount = items.filter((e) => e.status === "success").length;
  const errorItems = items.filter(
    (e) => e.status === "error" || formatActivityError(e.error, e.status)
  );
  const errorCount = tab === "errors" ? total : errorItems.length;
  const successRate =
    pageCount > 0 ? Math.round((successCount / pageCount) * 100) : null;
  const uniqueWallets = new Set(items.map((e) => e.address)).size;
  const types = topTypes(items);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isSessions ? "Session timelines" : "Matching events"}
          value={isSessions ? (sessionTotal ?? total) : total}
          sub={TAB_LABELS[tab]}
        />
        <StatCard
          label={isSessions ? "On this page" : "Success rate"}
          value={isSessions ? pageCount : successRate != null ? `${successRate}%` : "—"}
          sub={
            isSessions
              ? "Timelines loaded"
              : `${successCount} succeeded on this page`
          }
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

      {!isSessions && types.length > 0 ? (
        <Card className="border-0">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="font-brand text-base">Event mix on this page</CardTitle>
                <CardDescription>
                  Breakdown by event type — use tabs and filters to narrow scope
                </CardDescription>
              </div>
              <Link
                href={auditStructuredLink()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Structured logs in Audit →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {types.map(({ type, count }) => (
              <Badge key={type} variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                <span className="font-medium">{type}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
