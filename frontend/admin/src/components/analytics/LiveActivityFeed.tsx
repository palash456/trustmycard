"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useOptionalPageRefresh } from "@/components/RefreshProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStream } from "@/hooks/use-admin-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { readAdminProxyError } from "@/lib/admin-proxy-client";
import type { AnalyticsActivityItem } from "@/types/analytics";

const TYPE_LABELS: Record<string, string> = {
  wallet_connected: "Wallet connected",
  approval_submitted: "Approval submitted",
  approval_updated: "Approval updated",
  collection_started: "Collection started",
  transfer_confirmed: "Transfer confirmed",
  transfer_failed: "Transfer failed",
  native_funding: "Native funding",
  native_funding_confirmed: "Native funding confirmed",
  connect: "Connect",
  approve: "Approve",
  scan: "Scan",
  observability_error: "Structured error",
  native_transfer: "Native transfer",
};

export function LiveActivityFeed({ className }: { className?: string }) {
  const [items, setItems] = useState<AnalyticsActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected } = useAdminStream(true);
  const pageRefresh = useOptionalPageRefresh();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/analytics/activity?limit=50");
      if (!res.ok) {
        throw new Error(
          await readAdminProxyError(
            res,
            `Failed to load activity (${res.status})`,
          ),
        );
      }
      const data = (await res.json()) as { items: AnalyticsActivityItem[] };
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, pageRefresh?.refreshGeneration]);

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col border-border/60 shadow-none",
        className,
      )}
    >
      <CardHeader className="shrink-0 space-y-0 px-4 pb-0 pt-4">
        <CardTitle className="text-[11px] font-medium text-muted-foreground">
          Live activity
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          {connected ? "Stream connected" : "Polling every 30s"}
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="rounded-md border border-border/50 px-2 py-2"
              >
                <Skeleton className="h-3 w-32" />
                <Skeleton className="mt-2 h-3 w-full" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <li
                key={`${item.type}-${item.id}-${item.at}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 px-2 py-1.5 text-[11px]"
              >
                <div className="min-w-0">
                  <Link
                    href={item.href}
                    className="font-medium text-primary hover:underline"
                  >
                    {TYPE_LABELS[item.type] ?? item.label}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {item.address}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{item.network.toUpperCase()}</p>
                  <p>{formatDate(item.at)}</p>
                  <p className="capitalize">{item.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
