import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success:
    "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-600/15 dark:text-emerald-400",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  pending:
    "border-amber-600/30 bg-amber-600/10 text-amber-900 dark:border-amber-500/25 dark:bg-amber-600/15 dark:text-amber-400",
  rejected:
    "border-orange-600/30 bg-orange-600/10 text-orange-900 dark:border-orange-500/25 dark:bg-orange-600/15 dark:text-orange-400",
  completed:
    "border-emerald-500/45 bg-gradient-to-r from-emerald-600 to-green-500 px-2.5 text-white shadow-sm shadow-emerald-600/30 dark:from-emerald-500 dark:to-green-400 dark:text-emerald-950",
};

export function ActivityStatusChip({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key];
  const isCompleted = key === "completed";

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        isCompleted && "gap-1 rounded-full font-semibold tracking-[0.01em]",
        style,
      )}
    >
      {isCompleted ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
      {status}
    </Badge>
  );
}
