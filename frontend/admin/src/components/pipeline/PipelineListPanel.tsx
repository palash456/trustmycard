"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import {
  ApprovalsListChart,
  TransfersListChart,
} from "@/components/charts/ListPageCharts";
import { InfiniteScrollFooter } from "@/components/InfiniteScrollFooter";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListTableCard } from "@/components/ListTableCard";
import type { PipelineTab } from "@/components/pipeline/PipelineControls";
import {
  ApprovalsTable,
  NativeTransfersTable,
  TransfersTable,
  type ApprovalRow,
  type NativeRow,
  type TransferRow,
} from "@/components/pipeline/PipelineTables";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScrollList } from "@/hooks/use-infinite-scroll-list";
import { buildQuery } from "@/lib/admin-query";
import { readAdminProxyError } from "@/lib/admin-proxy-client";

const PAGE_SIZE = 30;

type FilterQuery = Record<string, string | undefined>;

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function listEndpoint(tab: PipelineTab): string {
  if (tab === "transfers") return "/api/admin/transfers";
  if (tab === "native") return "/api/admin/native-transfers";
  return "/api/admin/approvals";
}

function buildListQuery(tab: PipelineTab, filters: FilterQuery, page: number) {
  const owner = filters.owner?.trim() || undefined;
  const base = {
    page: String(page),
    limit: String(PAGE_SIZE),
    owner,
    network: filters.network,
    status: filters.status,
  };
  if (tab === "approvals") {
    return buildQuery({
      ...base,
      collectionEnabled: filters.collectionEnabled,
    });
  }
  return buildQuery(base);
}

async function fetchPipelinePage<T>(
  tab: PipelineTab,
  filters: FilterQuery,
  page: number,
): Promise<Paginated<T>> {
  const qs = buildListQuery(tab, filters, page);
  const res = await fetch(`${listEndpoint(tab)}${qs}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      await readAdminProxyError(res, `Failed to load ${tab} (${res.status})`),
    );
  }
  return (await res.json()) as Paginated<T>;
}

function emptyMessage(tab: PipelineTab): string {
  if (tab === "transfers") return "No transfers found";
  if (tab === "native") return "No native transfers found";
  return "No approvals found";
}

function endLabel(tab: PipelineTab): string {
  if (tab === "transfers") return "End of transfers";
  if (tab === "native") return "End of native transfers";
  return "End of approvals";
}

export function PipelineListPanel({
  tab,
  query,
  toolbar,
  onTotalChange,
}: {
  tab: PipelineTab;
  query: FilterQuery;
  toolbar?: ReactNode;
  onTotalChange?: (total: number) => void;
}) {
  const fetchPage = useCallback(
    async (page: number) => {
      if (tab === "transfers") {
        return fetchPipelinePage<TransferRow>(tab, query, page);
      }
      if (tab === "native") {
        return fetchPipelinePage<NativeRow>(tab, query, page);
      }
      return fetchPipelinePage<ApprovalRow>(tab, query, page);
    },
    [query, tab],
  );

  const { items, total, loadingPhase, loading, error, hasMore, sentinelRef } =
    useInfiniteScrollList<ApprovalRow | TransferRow | NativeRow>({
      fetchPage,
    });

  useEffect(() => {
    onTotalChange?.(total);
  }, [onTotalChange, total]);

  const typedItems = items as ApprovalRow[] | TransferRow[] | NativeRow[];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length > 0
            ? `${items.length} of ${total}${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : !loading
              ? emptyMessage(tab)
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LogSearchBar
            action="/pipeline"
            className="w-80 min-w-0 gap-1 sm:w-96"
            defaultValue={query.owner}
            query={query}
            placeholder="Search by wallet address"
            paramName="owner"
          />
          <Separator orientation="vertical" className="h-8" />
          {toolbar}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {tab === "approvals" && typedItems.length > 0 ? (
        <ApprovalsListChart items={typedItems as ApprovalRow[]} />
      ) : null}
      {tab === "transfers" && typedItems.length > 0 ? (
        <TransfersListChart items={typedItems as TransferRow[]} />
      ) : null}

      {items.length === 0 && !loading ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-0">
            <ListEmptyState message={emptyMessage(tab)} />
          </CardContent>
        </Card>
      ) : items.length === 0 && loading ? (
        <PipelineTableSkeleton />
      ) : (
        <ListTableCard>
          {tab === "approvals" ? (
            <ApprovalsTable items={typedItems as ApprovalRow[]} />
          ) : null}
          {tab === "transfers" ? (
            <TransfersTable items={typedItems as TransferRow[]} />
          ) : null}
          {tab === "native" ? (
            <NativeTransfersTable items={typedItems as NativeRow[]} />
          ) : null}
        </ListTableCard>
      )}

      <InfiniteScrollFooter
        sentinelRef={sentinelRef}
        loadingMore={loadingPhase === "more"}
        hasMore={hasMore}
        loading={loading}
        itemCount={items.length}
        endLabel={endLabel(tab)}
      />
    </div>
  );
}

function PipelineTableSkeleton() {
  return (
    <div className="divide-y divide-border/60 rounded-md border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
