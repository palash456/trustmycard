"use client";

import { Clock, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTestRunTimer } from "@/hooks/use-test-run-timer";
import { cn } from "@/lib/utils";

type TestRunTimerProps = {
  active: boolean;
  estimatedTotalMs: number;
  /** When provided, elapsed time is measured from this timestamp (batch runs). */
  startedAt?: number;
  /** e.g. "Suite 3 of 12" or "Domain migration" */
  progressLabel?: string;
  variant?: "banner" | "inline" | "compact";
  className?: string;
  /** Freeze elapsed/remaining ticks while paused between batch suites. */
  frozen?: boolean;
  /** Batch run: pause after the current suite finishes. */
  onPause?: () => void;
  onResume?: () => void;
  paused?: boolean;
  /** Stops the active run and hides the timer when invoked. */
  onStop?: () => void;
  stopLabel?: string;
};

export function TestRunTimer({
  active,
  estimatedTotalMs,
  startedAt,
  progressLabel,
  variant = "banner",
  className,
  frozen = false,
  onPause,
  onResume,
  paused = false,
  onStop,
  stopLabel = "Stop",
}: TestRunTimerProps) {
  const { elapsedLabel, remainingLabel, isOvertime } = useTestRunTimer(
    active,
    estimatedTotalMs,
    startedAt,
    frozen,
  );

  if (!active) return null;

  const elapsedText = (
    <span>
      Time spent:{" "}
      <span className="font-mono font-medium tabular-nums text-foreground">
        {elapsedLabel}
      </span>
    </span>
  );

  const remainingText = (
    <span>
      Est. remaining:{" "}
      <span
        className={cn(
          "font-mono font-medium tabular-nums",
          isOvertime ? "text-amber-700 dark:text-amber-400" : "text-foreground",
        )}
      >
        {isOvertime ? "00:00" : remainingLabel}
      </span>
      {isOvertime ? (
        <span className="ml-1 text-amber-700 dark:text-amber-400">
          · finishing up…
        </span>
      ) : null}
    </span>
  );

  const controlButtons =
    onPause || onResume || onStop ? (
      <div className="flex shrink-0 items-center gap-2">
        {paused
          ? onResume && (
              <Button type="button" size="sm" onClick={onResume}>
                <Play className="size-3.5" />
                Resume
              </Button>
            )
          : onPause && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onPause}
              >
                <Pause className="size-3.5" />
                Pause
              </Button>
            )}
        {onStop ? (
          <Button type="button" variant="outline" size="sm" onClick={onStop}>
            <Square className="size-3.5" />
            {stopLabel}
          </Button>
        ) : null}
      </div>
    ) : null;

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground",
          className,
        )}
      >
        {progressLabel ? (
          <span className="font-medium text-foreground/80">{progressLabel}</span>
        ) : null}
        {elapsedText}
        <span className="text-muted-foreground/50">·</span>
        {remainingText}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
          className,
        )}
      >
        <Clock
          className={cn(
            "size-3.5 shrink-0 text-primary",
            !frozen && "animate-pulse",
          )}
        />
        {progressLabel ? (
          <span className="font-medium text-foreground">{progressLabel}</span>
        ) : null}
        {elapsedText}
        {remainingText}
        {controlButtons}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground",
        paused && "border-amber-600/25 bg-amber-500/5",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Clock
        className={cn(
          "size-4 shrink-0 text-primary",
          !frozen && "animate-pulse",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {progressLabel ? (
          <span className="font-medium text-foreground">{progressLabel}</span>
        ) : null}
        {elapsedText}
        {remainingText}
      </div>
      {controlButtons}
    </div>
  );
}
