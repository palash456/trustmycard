import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS: Record<string, { variant: StatusVariant; className?: string }> = {
  ACTIVE: {
    variant: "default",
    className:
      "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  },
  SUBMITTED: {
    variant: "secondary",
    className:
      "border-sky-800/30 bg-sky-800/10 text-sky-950 dark:border-sky-500/20 dark:bg-sky-600/15 dark:text-sky-400",
  },
  PARTIALLY_USED: {
    variant: "secondary",
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  COMPLETED: { variant: "outline" },
  REVOKED: { variant: "destructive" },
  EXPIRED: { variant: "outline" },
  SUPERSEDED: { variant: "outline" },
  FAILED: { variant: "destructive" },
  confirmed: {
    variant: "default",
    className:
      "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  },
  pending: {
    variant: "secondary",
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  broadcast: {
    variant: "secondary",
    className:
      "border-sky-800/30 bg-sky-800/10 text-sky-950 dark:border-sky-500/20 dark:bg-sky-600/15 dark:text-sky-400",
  },
  prepared: { variant: "outline" },
  failed: { variant: "destructive" },
};

export function StatusBadge({ value }: { value: string }) {
  const config = STATUS[value] ?? { variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={cn("font-medium", config.className)}>
      {value}
    </Badge>
  );
}
