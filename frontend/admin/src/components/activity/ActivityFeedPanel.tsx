"use client";

import { useCallback, type ReactNode } from "react";
import { ActivityFeedRow } from "@/components/activity/ActivityFeedRow";
import { ActivityOverviewSection } from "@/components/activity/ActivityOverviewSection";
import {
  ACTIVITY_COL,
  ACTIVITY_HEAD_CELL,
} from "@/components/activity/activity-table-columns";
import type { ActivityTab } from "@/components/activity/ActivityTabsNav";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import { InfiniteScrollFooter } from "@/components/InfiniteScrollFooter";
import { ListEmptyState } from "@/components/ListEmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfiniteScrollList } from "@/hooks/use-infinite-scroll-list";
import { buildQuery } from "@/lib/admin-api";
import { readAdminProxyError } from "@/lib/admin-proxy-client";
import {
  getStructuredLogFetchWindow,
  type ResolvedStructuredLogRange,
} from "@/lib/structured-logs-range";
import {
  looksLikeFlowTransactionId,
  looksLikeWalletAddress,
} from "@/lib/transaction-id";
import { cn } from "@/lib/utils";
import type { ActivityFeedResponse } from "@/types/activity-feed";

const PAGE_SIZE = 30;

type FilterQuery = Record<string, string | undefined>;

function headClass(column: keyof typeof ACTIVITY_COL, extra?: string) {
  return cn(ACTIVITY_HEAD_CELL, ACTIVITY_COL[column], extra);
}

const TABLE_MIN_WIDTH = Object.values(ACTIVITY_COL).reduce((sum, col) => {
  const match = col.match(/w-\[(\d+)px\]/);
  return sum + (match ? Number(match[1]) : 0);
}, 0);

async function fetchActivityPage(
  filters: FilterQuery,
  tab: ActivityTab,
  page: number,
  range: { from: string; to: string },
): Promise<ActivityFeedResponse> {
  const transactionId =
    filters.transactionId?.trim() || filters.traceId?.trim() || undefined;

  const qs = buildQuery({
    page: String(page),
    limit: String(PAGE_SIZE),
    tab: tab === "all" ? undefined : tab,
    network: filters.network,
    address: filters.address,
    type: filters.type,
    status: filters.status,
    search: filters.search,
    traceId: transactionId,
    transactionId,
    from: range.from,
    to: range.to,
  });

  const res = await fetch(`/api/admin/activity/feed${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await readAdminProxyError(res, `Failed to load activity (${res.status})`),
    );
  }
  return (await res.json()) as ActivityFeedResponse;
}

function activitySearchMap(trimmed: string): Record<string, string> {
  if (looksLikeFlowTransactionId(trimmed)) {
    return { transactionId: trimmed };
  }
  if (looksLikeWalletAddress(trimmed)) {
    return { address: trimmed };
  }
  return { search: trimmed };
}

export function ActivityFeedPanel({
  query,
  tab,
  timeRange,
  toolbar,
}: {
  query: FilterQuery;
  tab: ActivityTab;
  timeRange: ResolvedStructuredLogRange;
  toolbar?: ReactNode;
}) {
  const fetchPage = useCallback(
    async (page: number) => {
      const window = getStructuredLogFetchWindow(timeRange);
      return fetchActivityPage(query, tab, page, window);
    },
    [query, tab, timeRange],
  );

  const { items, total, loadingPhase, loading, error, hasMore, sentinelRef } =
    useInfiniteScrollList({ fetchPage });

  const showErrorCol = tab === "errors" || tab === "all" || tab === "flow";
  const tableMinWidth = showErrorCol ? TABLE_MIN_WIDTH : TABLE_MIN_WIDTH - 220;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length > 0
            ? `${items.length} of ${total} in ${timeRange.label}${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : !loading
              ? `No activity in ${timeRange.label}`
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LogSearchBar
            action="/activity"
            className="w-80 min-w-0 gap-1 sm:w-96"
            defaultValue={
              query.search ??
              query.transactionId ??
              query.traceId ??
              query.address
            }
            query={query}
            placeholder="Search wallet, message, tx hash, or flow-* ID"
            mapValue={activitySearchMap}
          />
          <Separator orientation="vertical" className="h-8" />
          {toolbar}
        </div>
      </div>

      <ActivityOverviewSection tab={tab} total={total} items={items} />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-0">
          {items.length === 0 && !loading ? (
            <ListEmptyState message={`No activity in ${timeRange.label}`} />
          ) : items.length === 0 && loading ? (
            <ActivityTableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table
                className="w-full table-fixed"
                style={{ minWidth: tableMinWidth }}
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={headClass("time")}>Time</TableHead>
                    <TableHead className={headClass("transactionId")}>
                      Transaction ID
                    </TableHead>
                    <TableHead className={headClass("user")}>User</TableHead>
                    <TableHead className={headClass("wallet")}>Wallet</TableHead>
                    <TableHead className={headClass("network")}>
                      Network
                    </TableHead>
                    <TableHead className={headClass("step")}>Step</TableHead>
                    <TableHead className={headClass("status")}>Status</TableHead>
                    <TableHead className={headClass("details")}>
                      Details
                    </TableHead>
                    {showErrorCol ? (
                      <TableHead className={headClass("error")}>Error</TableHead>
                    ) : null}
                    <TableHead className={headClass("action", "text-right")}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={`${row.source}-${row.id}`}>
                      <ActivityFeedRow row={row} showError={showErrorCol} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InfiniteScrollFooter
        sentinelRef={sentinelRef}
        loadingMore={loadingPhase === "more"}
        hasMore={hasMore}
        loading={loading}
        itemCount={items.length}
        endLabel="End of activity"
      />
    </div>
  );
}

function ActivityTableSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-3.5 w-32 md:block" />
        </div>
      ))}
    </div>
  );
}
