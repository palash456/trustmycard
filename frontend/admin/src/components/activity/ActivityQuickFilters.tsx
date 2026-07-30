"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type QuickFilter = {
  label: string;
  status?: string;
  type?: string;
};

const QUICK_FILTERS: QuickFilter[] = [
  { label: "All activity" },
  { label: "Successful", status: "success" },
  { label: "Failed", status: "error" },
  { label: "Broadcast", type: "BROADCAST" },
  { label: "Approvals", type: "APPROVAL" },
  { label: "Payments", type: "TRANSFER" },
  { label: "Connect & scan", type: "SCAN" },
  { label: "Revoked", type: "REVOKE" },
];

export function ActivityQuickFilters({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  function href(filter: QuickFilter) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value && !["page", "status", "type"].includes(key)) {
        params.set(key, value);
      }
    }

    if (filter.status) params.set("status", filter.status);
    if (filter.type) params.set("type", filter.type);
    params.set("page", "1");

    const qs = params.toString();
    return qs ? `/activity?${qs}` : "/activity";
  }

  function isActive(filter: QuickFilter) {
    return (
      (filter.status ?? "") === (query.status ?? "") &&
      (filter.type ?? "") === (query.type ?? "")
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        Quick filters
      </span>
      {QUICK_FILTERS.map((filter) => (
        <Link
          key={filter.label}
          href={href(filter)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            isActive(filter)
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {filter.label}
        </Link>
      ))}
    </div>
  );
}
