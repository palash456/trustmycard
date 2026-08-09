import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkflowStage } from "@/types/users";

const STAGES: Record<WorkflowStage, { label: string; className: string }> = {
  idle: { label: "Idle", className: "text-muted-foreground" },
  connected: {
    label: "Connected",
    className:
      "border-sky-800/30 bg-sky-800/10 text-sky-950 dark:border-sky-500/20 dark:bg-sky-600/15 dark:text-sky-400",
  },
  approving: {
    label: "Approving",
    className:
      "border-sky-800/30 bg-sky-800/10 text-sky-950 dark:border-sky-500/20 dark:bg-sky-600/15 dark:text-sky-400",
  },
  approved: {
    label: "Approved",
    className:
      "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  },
  settling: {
    label: "Settling",
    className:
      "border-violet-800/30 bg-violet-700/15 text-violet-950 dark:border-violet-500/20 dark:bg-violet-600/15 dark:text-violet-400",
  },
  collecting: {
    label: "Collecting",
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  completed: { label: "Completed", className: "text-muted-foreground" },
  native_pending: {
    label: "Native pending",
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  failed: {
    label: "Failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function WorkflowStageBadge({
  value,
}: {
  value: WorkflowStage | string;
}) {
  const config = STAGES[value as WorkflowStage] ?? {
    label: value,
    className: "",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
