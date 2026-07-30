import {
  pipelineStageStatusLabel,
  type PipelineAttempt,
  type PipelineStageStatus,
} from "@/types/pipeline";
import { cn } from "@/lib/utils";

function badgeClass(status: PipelineStageStatus): string {
  switch (status) {
    case "success":
      return "border-green-500/40 bg-green-500/10";
    case "failed":
      return "border-destructive/40 bg-destructive/10";
    case "running":
      return "border-primary/40 bg-primary/10";
    case "retried":
      return "border-amber-500/40 bg-amber-500/10";
    default:
      return "border-border bg-muted/30";
  }
}

export function PipelineAttemptTimeline({
  attempts,
}: {
  attempts: PipelineAttempt[];
}) {
  if (attempts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No transfer attempts yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Attempt history</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attempts.map((attempt) => (
          <div
            key={attempt.id}
            className={cn("rounded-md border p-2 text-xs", badgeClass(attempt.status))}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Attempt #{attempt.attemptNumber}</span>
              <span className="uppercase tracking-wide">
                {pipelineStageStatusLabel(attempt.status)}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {new Date(attempt.at).toLocaleString()}
            </p>
            {attempt.txHash ? (
              <p className="mt-1 truncate font-mono">{attempt.txHash}</p>
            ) : null}
            {attempt.error ? (
              <p className="mt-1 text-destructive">{attempt.error}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
