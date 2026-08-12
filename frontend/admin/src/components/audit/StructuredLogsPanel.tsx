"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Download, Loader2 } from "lucide-react";
import { JourneyTableCell } from "@/components/JourneyPageHeader";
import { StructuredLogsLoadingStatus } from "@/components/audit/StructuredLogsLoadingStatus";
import { ListEmptyState } from "@/components/ListEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  istLocalToUtcIso,
  isValidDateYmd,
  isValidTimeHms,
  todayIstYmd,
} from "@/lib/ist-datetime";
import { timelineDetailLink } from "@/lib/log-links";
import type {
  ObservabilityEventRow,
  PaginatedResponse,
} from "@/lib/observability";
import { recordStructuredLogsFetchSample } from "@/lib/structured-logs-eta";
import { resolveTransactionId } from "@/lib/transaction-id";

/** Smaller batches = faster first paint; scroll loads more. */
const PAGE_SIZE = 30;
const EXPORT_PAGE_SIZE = 500;

const DURATION_PRESETS = [
  { id: "15m", label: "Last 15 minutes", ms: 15 * 60 * 1000 },
  { id: "1h", label: "Last 1 hour", ms: 60 * 60 * 1000 },
  { id: "6h", label: "Last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

type DurationPresetId = (typeof DURATION_PRESETS)[number]["id"] | "custom";

type FilterQuery = Record<string, string | undefined>;

async function fetchStructuredPage(
  filters: FilterQuery,
  page: number,
  opts?: {
    limit?: number;
    includePayload?: boolean;
    from?: string;
    to?: string;
    skipCount?: boolean;
    knownTotal?: number;
  },
): Promise<PaginatedResponse<ObservabilityEventRow>> {
  const limit = opts?.limit ?? PAGE_SIZE;
  const started = performance.now();
  const qs = buildQuery({
    tab: "structured",
    page: String(page),
    limit: String(limit),
    sort: filters.sort ?? "ts:desc",
    search: filters.search,
    module: filters.module,
    operation: filters.operation,
    stage: filters.stage,
    status: filters.status,
    level: filters.level,
    walletAddress: filters.walletAddress,
    sessionId: filters.sessionId,
    traceId: filters.traceId,
    correlationId: filters.correlationId,
    txHash: filters.txHash,
    errorCode: filters.errorCode,
    from: opts?.from ?? filters.from,
    to: opts?.to ?? filters.to,
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
  recordStructuredLogsFetchSample(performance.now() - started, limit);
  return data;
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

export function StructuredLogsPanel({ query }: { query: FilterQuery }) {
  const [items, setItems] = useState<ObservabilityEventRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "more" | null>(
    "initial",
  );
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);
  const totalRef = useRef(0);
  const unfiltered = !query.from && !query.to;

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoadingPhase(replace ? "initial" : "more");
      setError(null);
      try {
        const data = await fetchStructuredPage(query, nextPage, {
          skipCount: !replace && nextPage > 1,
          knownTotal: totalRef.current,
        });
        totalRef.current = data.total;
        setTotal(data.total);
        setPage(data.page);
        setItems((prev) =>
          replace ? data.items : [...prev, ...data.items],
        );
        setHasMore(data.page * data.limit < data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
        if (replace) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        setLoadingPhase(null);
        inFlightRef.current = false;
      }
    },
    [query],
  );

  useEffect(() => {
    let cancelled = false;
    totalRef.current = 0;
    void (async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoadingPhase("initial");
      setError(null);
      try {
        const data = await fetchStructuredPage(query, 1);
        if (cancelled) return;
        totalRef.current = data.total;
        setTotal(data.total);
        setPage(data.page);
        setItems(data.items);
        setHasMore(data.page * data.limit < data.total);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load logs");
        setItems([]);
        setHasMore(false);
      } finally {
        if (!cancelled) setLoadingPhase(null);
        inFlightRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // Parent remounts this panel when filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingPhase) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          !inFlightRef.current &&
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
            ? `${items.length} of ${total} log${total === 1 ? "" : "s"} loaded${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : null}
        </p>
        <DownloadLogsButton />
      </div>

      {loadingPhase === "initial" ? (
        <StructuredLogsLoadingStatus
          active
          phase="initial"
          pageSize={PAGE_SIZE}
          unfiltered={unfiltered}
        />
      ) : null}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-0">
          {items.length === 0 && !loading ? (
            <ListEmptyState message="No structured logs found" />
          ) : items.length === 0 && loading ? (
            <StructuredLogsTableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Wallet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const journeyId = resolveTransactionId({
                    transactionId: row.sessionId,
                    traceId: row.traceId,
                  });
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(row.ts)}
                      </TableCell>
                      <TableCell>
                        <JourneyTableCell transactionId={journeyId} />
                      </TableCell>
                      <TableCell>
                        {row.level ? (
                          <Badge variant="outline" className="text-[10px]">
                            {row.level}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.module}/{row.operation}
                        {row.stage ? ` · ${row.stage}` : ""}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={row.status} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs">
                        {row.message}
                        {row.errorMessage ? (
                          <span className="block text-destructive">
                            {row.errorMessage}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.walletAddress ? (
                          <Link
                            href={`/users/${encodeURIComponent(row.walletAddress)}`}
                            className="text-primary hover:underline"
                          >
                            {row.walletAddress.slice(0, 10)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                        {journeyId ? (
                          <Link
                            href={timelineDetailLink(journeyId)}
                            className="ml-1 block text-primary hover:underline"
                          >
                            timeline
                          </Link>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div ref={sentinelRef} className="space-y-2">
        {loadingPhase === "more" ? (
          <StructuredLogsLoadingStatus
            active
            phase="more"
            pageSize={PAGE_SIZE}
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

function DownloadLogsButton() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<DurationPresetId>("1h");
  const [fromDate, setFromDate] = useState(todayIstYmd());
  const [fromTime, setFromTime] = useState("00:00:00");
  const [toDate, setToDate] = useState(todayIstYmd());
  const [toTime, setToTime] = useState("23:59:59");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resolveRange(): { from: string; to: string } | null {
    if (preset !== "custom") {
      const found = DURATION_PRESETS.find((p) => p.id === preset);
      if (!found) return null;
      const to = new Date();
      const from = new Date(to.getTime() - found.ms);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (!isValidDateYmd(fromDate) || !isValidDateYmd(toDate)) {
      setError("Custom range needs valid dates (YYYY-MM-DD).");
      return null;
    }
    if (!isValidTimeHms(fromTime) || !isValidTimeHms(toTime)) {
      setError("Times must be HH:mm:ss.");
      return null;
    }
    const from = istLocalToUtcIso(fromDate, fromTime);
    const to = istLocalToUtcIso(toDate, toTime);
    if (!from || !to) {
      setError("Could not parse custom range.");
      return null;
    }
    if (new Date(from).getTime() > new Date(to).getTime()) {
      setError("From must be earlier than To.");
      return null;
    }
    return { from, to };
  }

  async function onDownload() {
    setError(null);
    setStatus(null);
    const range = resolveRange();
    if (!range) return;

    setPending(true);
    try {
      const all: ObservabilityEventRow[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        setStatus(`Fetching page ${page}…`);
        const data = await fetchStructuredPage({}, page, {
          limit: EXPORT_PAGE_SIZE,
          includePayload: true,
          from: range.from,
          to: range.to,
        });
        all.push(...data.items);
        totalPages = data.totalPages;
        page += 1;
        if (page > 200) {
          throw new Error("Export aborted — too many pages (safety cap).");
        }
      } while (page <= totalPages);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadJsonFile(`structured-logs-${stamp}.json`, {
        exportedAt: new Date().toISOString(),
        from: range.from,
        to: range.to,
        count: all.length,
        items: all,
      });
      setStatus(`Downloaded ${all.length} log${all.length === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setStatus(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Download className="size-3.5 opacity-70" />
        Download logs
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Download structured logs</SheetTitle>
            <SheetDescription>
              Pick a duration. All matching logs in that window are exported as
              JSON (including payloads).
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div className="grid gap-2">
              <Label className="text-[11px] text-muted-foreground">
                Duration
              </Label>
              <div className="grid gap-1.5">
                {DURATION_PRESETS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreset(opt.id)}
                    className={
                      preset === opt.id
                        ? "rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-left text-xs font-medium"
                        : "rounded-md border border-border/60 bg-background px-3 py-2 text-left text-xs hover:bg-muted/40"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  className={
                    preset === "custom"
                      ? "rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-left text-xs font-medium"
                      : "rounded-md border border-border/60 bg-background px-3 py-2 text-left text-xs hover:bg-muted/40"
                  }
                >
                  Custom date & time (IST)
                </button>
              </div>
            </div>

            {preset === "custom" ? (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-muted/15 p-3">
                <div className="grid gap-1">
                  <Label
                    htmlFor="dl-from-date"
                    className="text-[10px] text-muted-foreground"
                  >
                    From date
                  </Label>
                  <Input
                    id="dl-from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="dl-from-time"
                    className="text-[10px] text-muted-foreground"
                  >
                    From time
                  </Label>
                  <Input
                    id="dl-from-time"
                    type="time"
                    step={1}
                    value={fromTime}
                    onChange={(e) =>
                      setFromTime(
                        /^\d{2}:\d{2}$/.test(e.target.value)
                          ? `${e.target.value}:00`
                          : e.target.value,
                      )
                    }
                    className="h-8 text-xs tabular-nums"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="dl-to-date"
                    className="text-[10px] text-muted-foreground"
                  >
                    To date
                  </Label>
                  <Input
                    id="dl-to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="dl-to-time"
                    className="text-[10px] text-muted-foreground"
                  >
                    To time
                  </Label>
                  <Input
                    id="dl-to-time"
                    type="time"
                    step={1}
                    value={toTime}
                    onChange={(e) =>
                      setToTime(
                        /^\d{2}:\d{2}$/.test(e.target.value)
                          ? `${e.target.value}:00`
                          : e.target.value,
                      )
                    }
                    className="h-8 text-xs tabular-nums"
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {status ? (
              <p className="text-xs text-muted-foreground">{status}</p>
            ) : null}

            <Button
              type="button"
              className="mt-auto h-9 gap-1.5 text-xs"
              disabled={pending}
              onClick={onDownload}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {pending ? "Preparing download…" : "Download JSON"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
