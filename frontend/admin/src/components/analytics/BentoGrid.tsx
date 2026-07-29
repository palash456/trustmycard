import { cn } from "@/lib/utils";

/** 12-column bento layout primitives — children should use h-full on chart cards. */
export function BentoSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-14 space-y-3", className)}>
      <header className="space-y-0.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function BentoRow({
  children,
  className,
  minHeight,
}: {
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 items-stretch gap-3",
        minHeight,
        className
      )}
    >
      {children}
    </div>
  );
}

type Span = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

const SPAN: Record<Span, string> = {
  3: "col-span-12 sm:col-span-6 lg:col-span-3",
  4: "col-span-12 sm:col-span-6 lg:col-span-4",
  5: "col-span-12 lg:col-span-5",
  6: "col-span-12 md:col-span-6",
  7: "col-span-12 lg:col-span-7",
  8: "col-span-12 lg:col-span-8",
  9: "col-span-12 lg:col-span-9",
  12: "col-span-12",
};

export function BentoCell({
  span,
  children,
  className,
}: {
  span: Span;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(SPAN[span], "flex min-h-0 min-w-0 flex-col", className)}>
      {children}
    </div>
  );
}

/** Dense KPI strip — equal-height compact tiles. */
export function BentoMetrics({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 [&>*]:min-w-0">
      {children}
    </div>
  );
}

export function BentoPanel({
  title,
  children,
  className,
  padding = "default",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  padding?: "compact" | "default" | "none";
}) {
  const pad =
    padding === "compact" ? "p-3" : padding === "none" ? "p-0" : "p-4";
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-lg border border-border/60 bg-card/80",
        pad,
        className
      )}
    >
      {title ? (
        <p className="mb-2 shrink-0 text-[11px] font-medium text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
