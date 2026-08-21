"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  defaultStructuredLogsFetchMs,
  formatEtaSeconds,
  hasStructuredLogsSamples,
  predictStructuredLogsFetchMs,
} from "@/lib/structured-logs-eta";
import type { StructuredLogRangeId } from "@/lib/structured-logs-range";
import { cn } from "@/lib/utils";

type LoadingPhase = "initial" | "more";

export function StructuredLogsLoadingStatus({
  active,
  phase,
  pageSize,
  rangeId,
  fetchStartedAt,
  rangeLabel,
  itemsLoaded = 0,
  total = 0,
}: {
  active: boolean;
  phase: LoadingPhase;
  pageSize: number;
  rangeId: StructuredLogRangeId;
  /** `performance.now()` when the in-flight fetch began. */
  fetchStartedAt: number;
  rangeLabel?: string;
  itemsLoaded?: number;
  total?: number;
}) {
  const [now, setNow] = useState(() => performance.now());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    setNow(performance.now());
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [active, fetchStartedAt, phase, pageSize, rangeId]);

  if (!active) return null;

  // Session samples only exist in the browser; defer reads until after hydration.
  const predictedMs = mounted
    ? predictStructuredLogsFetchMs(pageSize, rangeId)
    : defaultStructuredLogsFetchMs(pageSize, rangeId);
  const elapsedMs = Math.max(0, now - fetchStartedAt);
  const remainingMs = Math.max(0, predictedMs - elapsedMs);
  const overdue = elapsedMs > predictedMs * 1.2;
  const progress = Math.min(
    overdue ? 0.94 : 0.97,
    elapsedMs / Math.max(predictedMs, 1),
  );
  const learned = mounted && hasStructuredLogsSamples(rangeId);
  const countdown = formatEtaSeconds(remainingMs);

  const headline =
    phase === "initial"
      ? overdue
        ? "Still fetching logs — finishing up"
        : `Fetching logs · ${rangeLabel ?? "selected range"}`
      : overdue
        ? "Loading more entries…"
        : `Loading next ${pageSize} logs`;

  const detail = overdue
    ? phase === "initial"
      ? "Taking longer than usual — the server is still querying your time window."
      : total > 0
        ? `${itemsLoaded} of ${total} loaded`
        : `${itemsLoaded} loaded`
    : `${countdown} remaining${
        learned ? " (based on your recent loads)" : " (calibrating)"
      }`;

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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-foreground">{headline}</p>
            {!overdue ? (
              <p className="font-mono text-sm font-semibold tabular-nums text-primary">
                {countdown}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">{detail}</p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70 transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
