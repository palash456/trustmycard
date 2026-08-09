import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PageSkeletonVariant =
  "list" | "dashboard" | "analytics" | "detail" | "pipeline-user" | "overlay";

function HeaderSkeleton({ toolbar = true }: { toolbar?: boolean }) {
  return (
    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {toolbar ? (
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      ) : null}
    </div>
  );
}

function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        count === 6
          ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
          : "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="admin-stagger-item rounded-xl bg-card p-4 ring-1 ring-black/[0.04] dark:ring-foreground/10"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/[0.04] dark:ring-foreground/10">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-0 divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="ml-auto h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-black/[0.04] dark:ring-foreground/10">
      <Skeleton className="h-4 w-36" />
      <Skeleton
        className={cn("mt-4 w-full rounded-lg", tall ? "h-56" : "h-44")}
      />
    </div>
  );
}

function BentoRowSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <ChartSkeleton tall />
      </div>
      <div className="lg:col-span-4">
        <ChartSkeleton />
      </div>
    </div>
  );
}

export function PageSkeleton({
  variant = "list",
}: {
  variant?: PageSkeletonVariant;
}) {
  if (variant === "overlay") {
    return (
      <div className="pointer-events-none space-y-4" aria-hidden>
        <StatGridSkeleton count={4} />
        <ChartSkeleton tall />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <HeaderSkeleton toolbar={false} />
        <div className="max-w-3xl space-y-3 rounded-xl bg-card p-6 ring-1 ring-black/[0.04] dark:ring-foreground/10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex justify-between gap-4 border-b border-border/40 pb-3 last:border-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "pipeline-user") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-36" />
        <HeaderSkeleton toolbar={false} />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <ChartSkeleton tall />
        <StatGridSkeleton count={4} />
        <ChartSkeleton tall />
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
        <StatGridSkeleton count={6} />
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton tall />
          </div>
          <div className="xl:col-span-2">
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/[0.04] dark:ring-foreground/10">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (variant === "analytics") {
    return (
      <div className="space-y-8">
        <HeaderSkeleton />
        <div className="rounded-xl bg-card p-5 ring-1 ring-black/[0.04] dark:ring-foreground/10">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
        <BentoRowSkeleton />
        <BentoRowSkeleton />
        <StatGridSkeleton count={4} />
        <BentoRowSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <StatGridSkeleton count={4} />
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  );
}
