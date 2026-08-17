"use client";

import {
  formatObservabilityMessageWithError,
  formatObservabilityModulePath,
} from "@trustmycard/shared/observability";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, Loader2 } from "lucide-react";
import { JourneyTableCell } from "@/components/JourneyPageHeader";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import { StructuredLogsLoadingStatus } from "@/components/audit/StructuredLogsLoadingStatus";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ObservabilityStatusBadge } from "@/components/audit/ObservabilityStatusBadge";
import { TruncatedLogMessage } from "@/components/audit/TruncatedLogMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { recordStructuredLogsFetchSample } from "@/lib/structured-logs-eta";
import type {
  ObservabilityEventRow,
  PaginatedResponse,
} from "@/lib/observability";
import {
  resolveStructuredLogSearchText,
  resolveStructuredLogTransactionId,
  resolveTransactionId,
  isStructuredLogExcludeNa,
} from "@/lib/transaction-id";

/** Smaller batches = faster first paint; scroll loads more. */
const PAGE_SIZE = 30;
const EXPORT_PAGE_SIZE = 500;

type FilterQuery = Record<string, string | undefined>;

async function fetchStructuredPage(
  filters: FilterQuery,
  page: number,
  range: { from: string; to: string },
  opts?: {
    limit?: number;
    includePayload?: boolean;
    skipCount?: boolean;
    knownTotal?: number;
    rangeId: StructuredLogRangeId;
  },
): Promise<PaginatedResponse<ObservabilityEventRow>> {
  const limit = opts?.limit ?? PAGE_SIZE;
  const started = performance.now();
  const transactionId = resolveStructuredLogTransactionId(filters);
  const search = resolveStructuredLogSearchText(filters);
  const qs = buildQuery({
    tab: "structured",
    page: String(page),
    limit: String(limit),
    sort: filters.sort ?? "ts:desc",
    search,
    module: filters.module,
    operation: filters.operation,
    stage: filters.stage,
    status: filters.status,
    level: filters.level,
    walletAddress: filters.walletAddress,
    transactionId,
    sessionId: transactionId ?? filters.sessionId,
    traceId: transactionId ?? filters.traceId,
    correlationId: filters.correlationId,
    txHash: filters.txHash,
    errorCode: filters.errorCode,
    excludeNa: isStructuredLogExcludeNa(filters) ? "1" : undefined,
    from: range.from,
    to: range.to,
    includePayload: opts?.includePayload ? "1" : undefined,
    skipCount: opts?.skipCount ? "1" : undefined,
    knownTotal:
      opts?.knownTotal != null ? String(opts.knownTotal) : undefined,
  });
  const res = await fetch(`/api/admin/observability/events${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await readAdminProxyError(res, `Failed to load logs (${res.status})`),
    );
  }
  const data = (await res.json()) as PaginatedResponse<ObservabilityEventRow>;
  recordStructuredLogsFetchSample(
    performance.now() - started,
    limit,
    opts?.rangeId ?? "15m",
  );
  return data;
}

function extractLogContext(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (record.context && typeof record.context === "object") {
    return record.context as Record<string, unknown>;
  }
  return record;
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StructuredLogsPanel({
  query,
  timeRange,
  toolbar,
}: {
  query: FilterQuery;
  timeRange: ResolvedStructuredLogRange;
  toolbar?: ReactNode;
}) {
  const [items, setItems] = useState<ObservabilityEventRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "more" | null>(
    "initial",
  );
  const [fetchStartedAt, setFetchStartedAt] = useState(() => performance.now());
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

      setFetchStartedAt(performance.now());
      setLoadingPhase(replace ? "initial" : "more");
      setError(null);
      if (replace) {
        totalRef.current = 0;
      }

      try {
        const data = await fetchStructuredPage(
          query,
          nextPage,
          window,
          {
            skipCount: !replace && nextPage > 1,
            knownTotal: totalRef.current,
            rangeId: timeRange.rangeId,
          },
        );
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
        setError(err instanceof Error ? err.message : "Failed to load logs");
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
                isStructuredLogExcludeNa(query) ? " · n/a hidden" : ""
              }${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : !loading
              ? `No logs in ${timeRange.label}`
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LogSearchBar
            action="/audit"
            className="w-80 min-w-0 gap-1 sm:w-96"
            defaultValue={
              query.search ??
              query.transactionId ??
              query.sessionId ??
              query.traceId
            }
            query={query}
            placeholder="Search logs"
          />
          <Separator orientation="vertical" className="h-8" />
          {toolbar}
          <DownloadLogsButton timeRange={timeRange} filters={query} />
        </div>
      </div>

      {loadingPhase === "initial" ? (
        <StructuredLogsLoadingStatus
          active
          phase="initial"
          pageSize={PAGE_SIZE}
          rangeId={timeRange.rangeId}
          fetchStartedAt={fetchStartedAt}
          rangeLabel={timeRange.label}
        />
      ) : null}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-0">
          {items.length === 0 && !loading ? (
            <ListEmptyState
              message={`No structured logs in ${timeRange.label}`}
            />
          ) : items.length === 0 && loading ? (
            <StructuredLogsTableSkeleton />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead className="min-w-[280px]">Transaction ID</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const journeyId = resolveTransactionId({
                    transactionId: row.sessionId,
                    traceId: row.traceId,
                  });
                  const displayJourneyRef =
                    journeyId ?? row.traceId ?? row.sessionId;
                  const context = extractLogContext(row.payload);
                  const { message, errorLine } = formatObservabilityMessageWithError({
                    module: row.module,
                    operation: row.operation,
                    stage: row.stage,
                    message: row.message,
                    errorMessage: row.errorMessage,
                    context,
                  });
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(row.ts)}
                      </TableCell>
                      <TableCell className="max-w-none whitespace-nowrap">
                        <JourneyTableCell transactionId={displayJourneyRef} />
                      </TableCell>
                      <TableCell className="max-w-none whitespace-nowrap">
                        {row.walletAddress ? (
                          <WalletAddressLink
                            address={row.walletAddress}
                            truncate={false}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <ObservabilityStatusBadge
                          status={row.status}
                          stage={row.stage}
                          operation={row.operation}
                          module={row.module}
                          level={row.level}
                          context={context}
                        />
                      </TableCell>
                      <TableCell>
                        <TruncatedLogMessage
                          message={message}
                          errorLine={errorLine}
                        />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatObservabilityModulePath(row.module, row.operation)}
                      </TableCell>
                      <TableCell>
                        {row.level ? (
                          <Badge variant="outline" className="text-[10px]">
                            {row.level}
                          </Badge>
                        ) : null}
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
          <StructuredLogsLoadingStatus
            active
            phase="more"
            pageSize={PAGE_SIZE}
            rangeId={timeRange.rangeId}
            fetchStartedAt={fetchStartedAt}
            rangeLabel={timeRange.label}
            itemsLoaded={items.length}
            total={total}
          />
        ) : null}
        <div className="flex h-8 items-center justify-center">
          {!loading && !hasMore && items.length > 0 ? (
            <span className="text-xs text-muted-foreground">End of logs</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StructuredLogsTableSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="hidden h-3.5 w-32 sm:block" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="hidden h-3.5 flex-1 md:block" />
        </div>
      ))}
    </div>
  );
}

function DownloadLogsButton({
  timeRange,
  filters,
}: {
  timeRange: ResolvedStructuredLogRange;
  filters: FilterQuery;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    const range = getStructuredLogFetchWindow(timeRange);
    setPending(true);
    try {
      const all: ObservabilityEventRow[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await fetchStructuredPage(filters, page, range, {
          limit: EXPORT_PAGE_SIZE,
          includePayload: true,
          rangeId: timeRange.rangeId,
        });
        all.push(...data.items);
        totalPages = data.totalPages;
        page += 1;
        if (page > 200) {
          throw new Error("Export aborted — too many pages (safety cap).");
        }
      } while (page <= totalPages);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const transactionId = resolveStructuredLogTransactionId(filters);
      downloadJsonFile(`structured-logs-${stamp}.json`, {
        exportedAt: new Date().toISOString(),
        range: timeRange.label,
        from: range.from,
        to: range.to,
        transactionId: transactionId ?? null,
        search: filters.search ?? null,
        module: filters.module ?? null,
        operation: filters.operation ?? null,
        stage: filters.stage ?? null,
        status: filters.status ?? null,
        level: filters.level ?? null,
        walletAddress: filters.walletAddress ?? null,
        count: all.length,
        items: all,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={pending}
        onClick={() => void onDownload()}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5 opacity-70" />
        )}
        {pending ? "Downloading…" : "Download logs"}
      </Button>
      {error ? <p className="max-w-[200px] text-right text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
