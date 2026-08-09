"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { activityLink } from "@/lib/log-links";
import { cn } from "@/lib/utils";
import {
  flowchartStatusLabel,
  type FlowchartStage,
  type FlowchartVisualStatus,
} from "@/lib/pipeline-flowchart";

function statusOpacity(status: FlowchartVisualStatus): string {
  switch (status) {
    case "completed":
    case "active":
    case "failed":
      return "opacity-100";
    case "skipped":
      return "opacity-40";
    default:
      return "opacity-50";
  }
}

function statusBadgeClass(status: FlowchartVisualStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "active":
      return "bg-primary/15 text-primary";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted/60 text-muted-foreground";
  }
}

function StageTooltipContent({ stage }: { stage: FlowchartStage }) {
  return (
    <div className="max-h-[min(70vh,28rem)] space-y-2 overflow-y-auto py-0.5">
      <div>
        <p className="font-semibold text-popover-foreground">{stage.label}</p>
        <p className="text-muted-foreground">{stage.subtitle}</p>
        {stage.at ? (
          <p className="text-xs text-muted-foreground">
            {new Date(stage.at).toLocaleString()}
          </p>
        ) : null}
      </div>
      <p
        className={cn(
          "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          statusBadgeClass(stage.status),
        )}
      >
        {flowchartStatusLabel(stage.status)}
      </p>
      <dl className="grid gap-1 border-t border-border pt-2">
        {stage.details.map((d) => (
          <div
            key={`${d.label}-${d.value}`}
            className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
          >
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="break-all text-right font-medium text-popover-foreground">
              {d.value}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href={activityLink({
          address: stage.logQuery.walletAddress,
          network: stage.logQuery.network ?? stage.logQuery.search,
          tab: stage.logQuery.tab ?? "all",
          type:
            stage.logQuery.type ??
            stage.logQuery.module ??
            stage.logQuery.action,
        })}
        className="inline-block text-xs font-medium text-primary hover:underline"
      >
        View logs →
      </Link>
    </div>
  );
}

export function PipelineFlowchart({
  stages,
  compact = false,
}: {
  stages: FlowchartStage[];
  compact?: boolean;
}) {
  if (stages.length === 0) return null;

  return (
    <TooltipProvider delay={120}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col items-center gap-1 py-2",
          compact ? "max-w-md" : "max-w-xl",
        )}
      >
        {stages.map((stage, i) => (
          <Tooltip key={stage.key}>
            <TooltipTrigger
              type="button"
              className={cn(
                "group relative flex w-full flex-col items-center outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ring",
                statusOpacity(stage.status),
                stage.status === "active" && "scale-[1.02]",
                "hover:scale-[1.03] hover:opacity-100",
              )}
              style={{ width: `${stage.widthPercent}%` }}
            >
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-md px-4 text-left text-white shadow-md ring-2 transition-shadow duration-200",
                  compact ? "py-2" : "py-3",
                  `bg-gradient-to-r ${stage.gradient}`,
                  stage.ring,
                  "group-hover:shadow-lg group-hover:ring-4",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate font-semibold",
                        compact ? "text-xs" : "text-sm",
                      )}
                    >
                      {stage.label}
                    </p>
                    {!compact ? (
                      <p className="truncate text-[11px] text-white/80">
                        {stage.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      stage.status === "failed"
                        ? "bg-white/25"
                        : stage.status === "active"
                          ? "bg-white/30 animate-pulse"
                          : "bg-white/20",
                    )}
                  >
                    {flowchartStatusLabel(stage.status)}
                  </span>
                </div>
                {stage.status === "active" ? (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/40">
                    <div className="h-full w-1/2 animate-pulse bg-white/80" />
                  </div>
                ) : null}
              </div>
              {i < stages.length - 1 ? (
                <div
                  className="my-0.5 h-2 w-0 border-l-2 border-dashed border-muted-foreground/30"
                  aria-hidden
                />
              ) : null}
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="start"
              className="max-w-sm p-3 text-left text-popover-foreground"
            >
              <StageTooltipContent stage={stage} />
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
