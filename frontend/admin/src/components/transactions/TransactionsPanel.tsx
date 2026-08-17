"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { resolveTransactionDisplayStatus } from "@trustmycard/shared/observability";
import {
  CollectedAmounts,
} from "@/components/CollectedAmounts";
import { InrValue } from "@/components/InrValue";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import { ListEmptyState } from "@/components/ListEmptyState";
import { NetworkBadge } from "@/components/NetworkBadge";
import { TokenSymbolList } from "@/components/TokenSymbol";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildQuery } from "@/lib/admin-api";
import { readAdminProxyError } from "@/lib/admin-proxy-client";
import { formatDate } from "@/lib/format";
import {
  getStructuredLogFetchWindow,
  type ResolvedStructuredLogRange,
  type StructuredLogRangeId,
} from "@/lib/structured-logs-range";
import type {
  TransactionListItem,
  TransactionListResponse,
} from "@/types/transaction-journey";

const PAGE_SIZE = 30;

type FilterQuery = Record<string, string | undefined>;

function resolveRowStatus(row: TransactionListItem): {
  status: string;
  label: string;
} {
  const resolved = resolveTransactionDisplayStatus({
    terminalStatus: row.terminalStatus ?? "IN_PROGRESS",
  });
  return {
    status: row.displayStatus ?? resolved.status,
    label: row.statusLabel ?? resolved.label,
  };
}

async function fetchTransactionsPage(
  filters: FilterQuery,
  page: number,
  range: { from: string; to: string },
  opts?: {
    knownTotal?: number;
    rangeId: StructuredLogRangeId;
  },
): Promise<TransactionListResponse> {
  const qs = buildQuery({
    page: String(page),
    limit: String(PAGE_SIZE),
    search: filters.search,
    transactionId: filters.transactionId,
    walletAddress: filters.walletAddress,
    network: filters.network,
    status: filters.status,
    completedOnly: filters.completedOnly,
    from: range.from,
    to: range.to,
    skipCount: page > 1 ? "1" : undefined,
    knownTotal: opts?.knownTotal != null ? String(opts.knownTotal) : undefined,
  });

  const res = await fetch(`/api/admin/transactions${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await readAdminProxyError(res, `Failed to load transactions (${res.status})`),
    );
  }
  return (await res.json()) as TransactionListResponse;
}

export function TransactionsPanel({
  query,
  timeRange,
  toolbar,
}: {
  query: FilterQuery;
  timeRange: ResolvedStructuredLogRange;
  toolbar?: ReactNode;
}) {
  const [items, setItems] = useState<TransactionListItem[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "more" | null>(
    "initial",
  );
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const totalRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const generation = (loadGenerationRef.current += 1);
      const window = getStructuredLogFetchWindow(timeRange);

      if (!replace) {
        if (pagingRef.current) return;
        pagingRef.current = true;
      }

      setLoadingPhase(replace ? "initial" : "more");
      setError(null);
      if (replace) {
        totalRef.current = 0;
      }

      try {
        const data = await fetchTransactionsPage(query, nextPage, window, {
          knownTotal: totalRef.current,
          rangeId: timeRange.rangeId,
        });
        if (generation !== loadGenerationRef.current) return;

        totalRef.current = data.total;
        setTotal(data.total);
        setPage(data.page);
        setItems((prev) =>
          replace ? data.items : [...prev, ...data.items],
        );
        setHasMore(data.page * data.limit < data.total);
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load transactions");
        if (replace) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!replace) pagingRef.current = false;
        if (generation === loadGenerationRef.current) {
          setLoadingPhase(null);
        }
      }
    },
    [query, timeRange],
  );

  useEffect(() => {
    void loadPage(1, true);
    return () => {
      loadGenerationRef.current += 1;
      pagingRef.current = false;
    };
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingPhase) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          !pagingRef.current &&
          page >= 1
        ) {
          void loadPage(page + 1, false);
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadPage, loadingPhase, page]);

  const loading = loadingPhase !== null;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length > 0
            ? `${items.length} of ${total} in ${timeRange.label}${
                query.completedOnly === "1" ? " · completed with collection" : ""
              }${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : !loading
              ? `No transactions in ${timeRange.label}`
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LogSearchBar
            action="/transactions"
            className="w-80 min-w-0 gap-1 sm:w-96"
            defaultValue={
              query.search ?? query.transactionId ?? query.walletAddress
            }
            query={query}
            placeholder="Search transaction ID or wallet"
          />
          <Separator orientation="vertical" className="h-8" />
          {toolbar}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-0">
          {items.length === 0 && !loading ? (
            <ListEmptyState
              message={`No transactions in ${timeRange.label}`}
            />
          ) : items.length === 0 && loading ? (
            <TransactionsTableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Wallet Address</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Lifetime collected</TableHead>
                    <TableHead>Value (INR)</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const { status, label } = resolveRowStatus(row);
                    return (
                    <TableRow key={row.transactionId}>
                      <TableCell className="max-w-none whitespace-nowrap">
                        <TransactionIdLink
                          id={row.transactionId}
                          truncate={false}
                          token={
                            row.token && !row.token.includes(",")
                              ? row.token
                              : undefined
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <ActivityStatusChip status={status} label={label} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.username ? (
                          <Link
                            href={`/users/${encodeURIComponent(row.userPublicId ?? row.userId ?? "")}`}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {row.username}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-none whitespace-nowrap">
                        {row.walletAddress ? (
                          <WalletAddressLink
                            address={row.walletAddress}
                            profile="pipeline"
                            truncate={false}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <NetworkBadge network={row.network} />
                      </TableCell>
                      <TableCell>
                        <TokenSymbolList value={row.token} />
                      </TableCell>
                      <TableCell>
                        <CollectedAmounts
                          items={row.lifetimeCollected ?? []}
                        />
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        <InrValue
                          items={row.lifetimeCollected ?? []}
                          fallback={row.valueInr}
                        />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(row.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(row.lastActivityAt)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {row.eventCount}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={sentinelRef} className="space-y-2">
        {loadingPhase === "more" ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading more…
          </div>
        ) : null}
        <div className="flex h-8 items-center justify-center">
          {!loading && !hasMore && items.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              End of transactions
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TransactionsTableSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-3.5 w-52" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="hidden h-3.5 w-24 md:block" />
          <Skeleton className="hidden h-3.5 w-32 lg:block" />
        </div>
      ))}
    </div>
  );
}
