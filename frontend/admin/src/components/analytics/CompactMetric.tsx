import { cn } from "@/lib/utils";

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

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-muted/10 px-2.5 py-2",
        accentClass,
        className
      )}
    >
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums leading-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {hint}
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
    <div className="flex h-full flex-col justify-between rounded-md border border-border/60 bg-card/80 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        {share > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {share}%
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
