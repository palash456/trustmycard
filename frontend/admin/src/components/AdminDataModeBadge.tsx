"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdminDataMode } from "@/components/useAdminDataMode";

export function AdminDataModeBadge({ className }: { className?: string }) {
  const { meta } = useAdminDataMode();

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm",
        meta.badgeClass,
        className
      )}
    >
      <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dotClass)} aria-hidden />
      {meta.label}
    </Badge>
  );
}
