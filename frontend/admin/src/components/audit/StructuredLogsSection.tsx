"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { StructuredLogTimeRangeSelect } from "@/components/audit/StructuredLogTimeRangeSelect";
import { StructuredLogTransactionIdFilter } from "@/components/audit/StructuredLogTransactionIdFilter";
import { StructuredLogsPanel } from "@/components/audit/StructuredLogsPanel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildStructuredLogRangeParams,
  DEFAULT_STRUCTURED_LOG_RANGE,
  resolveStructuredLogRangeId,
  STRUCTURED_LOG_RANGE_PRESETS,
  type ResolvedStructuredLogRange,
} from "@/lib/structured-logs-range";

function resolveStableTimeRange(
  query: Record<string, string | undefined>,
): ResolvedStructuredLogRange | null {
  const rangeId = resolveStructuredLogRangeId(query);
  if (!rangeId) return null;

  if (rangeId === "custom") {
    if (!query.from?.trim() || !query.to?.trim()) return null;
    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
    return {
      rangeId: "custom",
      from: query.from,
      to: query.to,
      label: "Custom range",
    };
  }

  const preset = STRUCTURED_LOG_RANGE_PRESETS.find((p) => p.id === rangeId);
  if (!preset) return null;
  // Preset windows are computed at fetch time (rolling "last N minutes").
  return {
    rangeId,
    from: "",
    to: "",
    label: preset.label,
  };
}

export function StructuredLogsSection({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const rangeId = resolveStructuredLogRangeId(query);
  const resolved = useMemo(
    () => resolveStableTimeRange(query),
    [query.from, query.range, query.to],
  );

  useEffect(() => {
    if (rangeId) return;
    const params = buildStructuredLogRangeParams(
      query,
      DEFAULT_STRUCTURED_LOG_RANGE,
    );
    router.replace(`/audit?${params.toString()}`);
    // Redirect once when structured tab has no time window selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId, router]);

  if (!resolved) {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  const panelKey = [
    resolved.rangeId,
    query.range === "custom" ? `${query.from}|${query.to}` : "",
    query.search,
    query.module,
    query.operation,
    query.stage,
    query.status,
    query.level,
    query.walletAddress,
    query.transactionId,
    query.sessionId,
    query.traceId,
    query.correlationId,
    query.txHash,
    query.errorCode,
    query.sort,
  ].join("|");

  return (
    <div className="mt-4 space-y-3">
      <StructuredLogTransactionIdFilter
        key={query.transactionId ?? query.sessionId ?? query.traceId ?? ""}
        query={query}
      />
      <StructuredLogsPanel
        key={panelKey}
        query={query}
        timeRange={resolved}
        toolbar={<StructuredLogTimeRangeSelect query={query} />}
      />
    </div>
  );
}
