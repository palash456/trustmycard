import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label: string };
  className?: string;
}) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  return (
    <Card className={cn("border-border/80 bg-card shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub ? <p className="mt-1 text-xs font-medium text-muted-foreground">{sub}</p> : null}
        {trend ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium tabular-nums",
              trendUp && "text-emerald-600 dark:text-emerald-400",
              trendDown && "text-destructive",
              !trendUp && !trendDown && "text-muted-foreground"
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
