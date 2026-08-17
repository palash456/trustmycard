"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ActivityFeedPanel } from "@/components/activity/ActivityFeedPanel";
import { ActivityListToolbar } from "@/components/activity/ActivityListToolbar";
import type { ActivityTab } from "@/components/activity/ActivityTabsNav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildStructuredLogRangeParams,
  resolveStructuredLogRangeId,
  STRUCTURED_LOG_RANGE_PRESETS,
  type ResolvedStructuredLogRange,
} from "@/lib/structured-logs-range";

const DEFAULT_ACTIVITY_RANGE = "24h" as const;

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
  return {
    rangeId,
    from: "",
    to: "",
    label: preset.label,
  };
}

export function ActivityFeedSection({
  query,
  tab,
}: {
  query: Record<string, string | undefined>;
  tab: ActivityTab;
}) {
  const router = useRouter();
  const rangeId = resolveStructuredLogRangeId(query);
  const resolved = useMemo(
    () => resolveStableTimeRange(query),
    [query.from, query.range, query.to],
  );

  useEffect(() => {
    if (rangeId) return;
    const params = buildStructuredLogRangeParams(query, DEFAULT_ACTIVITY_RANGE);
    router.replace(`/activity?${params.toString()}`);
    // Redirect once when no time window is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId, router]);

  if (!resolved) {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  const panelKey = [
    tab,
    resolved.rangeId,
    query.range === "custom" ? `${query.from}|${query.to}` : "",
    query.network,
    query.address,
    query.type,
    query.status,
    query.search,
    query.transactionId,
    query.traceId,
  ].join("|");

  return (
    <ActivityFeedPanel
      key={panelKey}
      query={query}
      tab={tab}
      timeRange={resolved}
      toolbar={<ActivityListToolbar query={query} />}
    />
  );
}
