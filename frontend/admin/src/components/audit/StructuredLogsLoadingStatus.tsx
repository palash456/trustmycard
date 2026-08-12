"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  formatEtaSeconds,
  hasStructuredLogsSamples,
  predictStructuredLogsFetchMs,
} from "@/lib/structured-logs-eta";
import { cn } from "@/lib/utils";

type LoadingPhase = "initial" | "more";

export function StructuredLogsLoadingStatus({
  active,
  phase,
  pageSize,
  itemsLoaded = 0,
  total = 0,
  unfiltered,
}: {
  active: boolean;
  phase: LoadingPhase;
  pageSize: number;
  itemsLoaded?: number;
  total?: number;
  /** No date range — large scan likely. */
  unfiltered?: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    setTick(0);
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [active, phase, pageSize]);

  if (!active) return null;

  const predictedMs = predictStructuredLogsFetchMs(pageSize);
  const elapsedMs = tick * 200;
  const remainingMs = Math.max(0, predictedMs - elapsedMs);
  const overdue = elapsedMs > predictedMs * 1.15;
  const progress = Math.min(0.92, elapsedMs / Math.max(predictedMs, 1));
  const learned = hasStructuredLogsSamples();

  const headline =
    phase === "initial"
      ? overdue
        ? "Still pulling logs — large volume, almost there"
        : "Fetching structured logs from the database"
      : overdue
        ? "Loading more entries…"
        : `Loading next ${pageSize} logs`;

  const detail =
    phase === "initial"
      ? overdue
        ? unfiltered
          ? "This can take longer without a date filter. Narrow the IST range above for faster loads."
          : "The server is still working through your filters. This usually finishes within a few more seconds."
        : learned
          ? `About ${formatEtaSeconds(remainingMs)} remaining (estimated from your recent loads)`
          : `About ${formatEtaSeconds(remainingMs)} remaining (calibrating from this request)`
      : overdue
        ? total > 0
          ? `${itemsLoaded} of ${total} loaded so far`
          : `${itemsLoaded} loaded so far`
        : learned
          ? `~${formatEtaSeconds(remainingMs)} for this batch`
          : `~${formatEtaSeconds(remainingMs)} for this batch (calibrating)`;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5",
        phase === "initial"
          ? "border-primary/30 bg-primary/5"
          : "border-border/60 bg-muted/20",
      )}
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-foreground">{headline}</p>
          <p className="text-[11px] text-muted-foreground">{detail}</p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70 transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
