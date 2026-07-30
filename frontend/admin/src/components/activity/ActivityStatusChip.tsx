import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success:
    "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-600/15 dark:text-emerald-400",
  error:
    "border-destructive/30 bg-destructive/10 text-destructive",
  pending:
    "border-amber-600/30 bg-amber-600/10 text-amber-900 dark:border-amber-500/25 dark:bg-amber-600/15 dark:text-amber-400",
  rejected:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
};

export function ActivityStatusChip({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", style)}
    >
      {status}
    </Badge>
  );
}
