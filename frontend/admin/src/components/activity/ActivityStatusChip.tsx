import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success:
    "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-600/15 dark:text-emerald-400",
  completed:
    "border-emerald-600/25 bg-emerald-600/8 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-600/10 dark:text-emerald-400",
  in_progress:
    "border-sky-600/30 bg-sky-600/10 text-sky-900 dark:border-sky-500/25 dark:bg-sky-600/15 dark:text-sky-400",
  pending:
    "border-amber-600/30 bg-amber-600/10 text-amber-900 dark:border-amber-500/25 dark:bg-amber-600/15 dark:text-amber-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  failure: "border-destructive/30 bg-destructive/10 text-destructive",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
  canceled:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
  rejected:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
  revoked:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
  broadcast:
    "border-sky-800/30 bg-sky-800/10 text-sky-950 dark:border-sky-500/20 dark:bg-sky-600/15 dark:text-sky-400",
};

export function ActivityStatusChip({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  const normalized = (status ?? "unknown").trim() || "unknown";
  const key = normalized.toLowerCase();
  const style = STATUS_STYLES[key];
  const text = label ?? normalized;

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", style)}>
      {text}
    </Badge>
  );
}
