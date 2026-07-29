import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/types/users";

const HEALTH: Record<
  HealthStatus,
  { label: string; className: string }
> = {
  healthy: {
    label: "Healthy",
    className:
      "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  },
  warning: {
    label: "Warning",
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  error: {
    label: "Error",
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
  },
  idle: {
    label: "Idle",
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

export function UserHealthBadge({ value }: { value: HealthStatus | string }) {
  const config = HEALTH[value as HealthStatus] ?? HEALTH.idle;
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
