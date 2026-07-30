import { cn } from "@/lib/utils";
import {
  pipelineStageStatusLabel,
  type PipelineStage,
  type PipelineStageStatus,
} from "@/types/pipeline";
import { PipelineStageLogsLink } from "./PipelineStageLogsLink";

function badgeClass(status: PipelineStageStatus): string {
  switch (status) {
    case "success":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "running":
      return "bg-primary/15 text-primary";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "retried":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted/60 text-muted-foreground";
  }
}

export function PipelineStageRow({ stage }: { stage: PipelineStage }) {
  const metaEntries = Object.entries(stage.metadata).filter(
    ([, v]) => v != null && v !== ""
  );

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{stage.label}</p>
          {stage.at ? (
            <p className="text-xs text-muted-foreground">
              {new Date(stage.at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badgeClass(stage.status)
          )}
        >
          {pipelineStageStatusLabel(stage.status)}
        </span>
      </div>
      {metaEntries.length > 0 ? (
        <dl className="mt-2 grid gap-1 text-xs">
          {metaEntries.slice(0, 6).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[auto_1fr] gap-x-2">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="truncate text-right font-mono">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-2">
        <PipelineStageLogsLink logQuery={stage.logQuery} />
      </div>
    </div>
  );
}
