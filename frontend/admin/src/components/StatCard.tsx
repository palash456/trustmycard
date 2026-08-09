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
    <Card
      className={cn(
        "relative overflow-hidden border-0 bg-card transition-all duration-200 hover:shadow-md",
        className,
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/80 via-primary/40 to-transparent"
        aria-hidden
      />
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="font-brand text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {sub}
          </p>
        ) : null}
        {trend ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium tabular-nums",
              trendUp && "text-emerald-600 dark:text-emerald-400",
              trendDown && "text-destructive",
              !trendUp && !trendDown && "text-muted-foreground",
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
