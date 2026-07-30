"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePageRefresh } from "@/components/RefreshProvider";

export function PageRefreshButton({ className }: { className?: string }) {
  const { isRefreshing, refresh } = usePageRefresh();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 px-2.5 text-xs", className)}
      onClick={refresh}
      disabled={isRefreshing}
      aria-label="Refresh page"
      aria-busy={isRefreshing}
    >
      <RefreshCw
        className={cn("size-3.5 opacity-70", isRefreshing && "animate-spin opacity-100")}
      />
      <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh"}</span>
    </Button>
  );
}
