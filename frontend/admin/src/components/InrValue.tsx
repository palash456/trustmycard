"use client";

import type { CollectedAmountLike } from "@trustmycard/shared/fx";
import { formatInrValue } from "@trustmycard/shared/fx";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectedInr, useInrRates } from "@/components/InrRatesProvider";

export function InrValue({
  items,
  fallback,
  className,
}: {
  items: CollectedAmountLike[];
  fallback?: number | null;
  className?: string;
}) {
  const { loading, rates } = useInrRates();
  const value = useCollectedInr(items, fallback);

  if (loading && !rates && value == null) {
    return <Skeleton className="h-3.5 w-16" />;
  }

  return (
    <span className={className ?? "text-xs tabular-nums whitespace-nowrap"}>
      {formatInrValue(value)}
    </span>
  );
}
