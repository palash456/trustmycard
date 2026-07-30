"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type ActivityTab =
  | "all"
  | "connections"
  | "flow"
  | "user"
  | "errors"
  | "sessions";

const TABS: { value: ActivityTab; label: string; description: string }[] = [
  {
    value: "all",
    label: "All journeys",
    description: "Wallet journeys from QR scan through approval and payment",
  },
  {
    value: "connections",
    label: "Connect & scan",
    description: "Wallet connect and QR scan steps",
  },
  {
    value: "flow",
    label: "Authorization",
    description: "Prepare, sign, broadcast, and confirm steps",
  },
  {
    value: "user",
    label: "Payments",
    description: "Approvals, collections, and native payments",
  },
  {
    value: "errors",
    label: "Errors",
    description: "Failed steps in user journeys only",
  },
  {
    value: "sessions",
    label: "Sessions",
    description: "Completed authorization session summaries",
  },
];

export function ActivityTabsNav({
  activeTab,
  query,
}: {
  activeTab: ActivityTab;
  query: Record<string, string | undefined>;
}) {
  function href(tab: ActivityTab) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "tab" && k !== "page") {
        params.set(k, v);
      }
    }
    if (tab !== "all") params.set("tab", tab);
    params.set("page", "1");
    return `/activity?${params.toString()}`;
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
