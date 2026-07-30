"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuditTab } from "@/lib/log-links";

const TABS: { value: AuditTab; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin actions",
    description: "Settings updates, collector toggles, and manual transfers",
  },
  {
    value: "structured",
    label: "Structured logs",
    description: "Client and server structured observability events",
  },
  {
    value: "timelines",
    label: "Session timelines",
    description: "Authorization session journeys with stage breakdown",
  },
];

export function AuditTabsNav({
  activeTab,
  query,
}: {
  activeTab: AuditTab;
  query: Record<string, string | undefined>;
}) {
  function href(tab: AuditTab) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "tab" && k !== "page") params.set(k, v);
    }
    params.set("tab", tab);
    params.set("page", "1");
    return `/audit?${params.toString()}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={href(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {TABS.find((t) => t.value === activeTab)?.description}
      </p>
    </div>
  );
}
