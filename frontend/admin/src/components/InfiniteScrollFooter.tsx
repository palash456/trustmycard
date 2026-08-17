"use client";

import { Loader2 } from "lucide-react";

export function InfiniteScrollFooter({
  sentinelRef,
  loadingMore,
  hasMore,
  loading,
  itemCount,
  endLabel,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasMore: boolean;
  loading: boolean;
  itemCount: number;
  endLabel: string;
}) {
  return (
    <div ref={sentinelRef} className="space-y-2">
      {loadingMore ? (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading more…
        </div>
      ) : null}
      <div className="flex h-8 items-center justify-center">
        {!loading && !hasMore && itemCount > 0 ? (
          <span className="text-xs text-muted-foreground">{endLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
