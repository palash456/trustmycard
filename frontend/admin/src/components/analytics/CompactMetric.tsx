import { cn } from "@/lib/utils";
import { sanitizeMetricText } from "@/lib/analytics-format";

export function CompactMetric({
  label,
  value,
  hint,
  className,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
  accent?: "default" | "success" | "warning" | "danger";
}) {
  const accentClass = {
    default: "",
    success: "border-emerald-500/20 bg-emerald-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    danger: "border-destructive/20 bg-destructive/5",
  }[accent ?? "default"];

  const displayValue = sanitizeMetricText(value);
  const displayHint = hint ? sanitizeMetricText(hint) : undefined;
  const isLong = displayValue.length > 14;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg bg-card px-2.5 py-2 shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-150 hover:shadow-md dark:shadow-none dark:ring-foreground/10",
        accentClass,
        className,
      )}
    >
      <p className="truncate text-[10px] font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate font-semibold tabular-nums leading-tight text-foreground",
          isLong ? "text-xs" : "text-sm",
        )}
        title={String(value)}
      >
        {displayValue}
      </p>
      {displayHint ? (
        <p
          className="mt-0.5 truncate text-[10px] leading-snug text-muted-foreground"
          title={hint}
        >
          {displayHint}
        </p>
      ) : null}
    </div>
  );
}

export function AssetCard({
  label,
  value,
  share,
  sub,
}: {
  label: string;
  value: string;
  share: number;
  sub?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg bg-muted/30 px-2.5 py-2 ring-1 ring-black/[0.03] dark:ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
        {share > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {share}%
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 truncate text-base font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
