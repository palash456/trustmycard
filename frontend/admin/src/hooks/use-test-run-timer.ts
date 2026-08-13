"use client";

import { useEffect, useState } from "react";
import { formatTimerMmSs } from "@/lib/developer-test/benchmarks";

export type TestRunTimerState = {
  elapsedMs: number;
  remainingMs: number;
  elapsedLabel: string;
  remainingLabel: string;
  isOvertime: boolean;
};

/**
 * Live elapsed counter + countdown ETA while a test run is active.
 * Ticks every 250ms for smooth mm:ss display.
 */
export function useTestRunTimer(
  active: boolean,
  estimatedTotalMs: number,
  externalStartedAt?: number,
  /** When true, freeze elapsed/remaining display (batch paused between suites). */
  frozen = false,
): TestRunTimerState {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      setStartedAt(null);
      return;
    }

    const start = externalStartedAt ?? Date.now();
    setStartedAt(start);
    setNow(Date.now());

    if (frozen) return;

    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active, externalStartedAt, frozen]);

  const elapsedMs = startedAt != null ? Math.max(0, now - startedAt) : 0;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  const isOvertime = startedAt != null && elapsedMs > estimatedTotalMs;

  return {
    elapsedMs,
    remainingMs,
    elapsedLabel: formatTimerMmSs(elapsedMs),
    remainingLabel: formatTimerMmSs(remainingMs),
    isOvertime,
  };
}
