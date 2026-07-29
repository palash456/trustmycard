"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type ActivityTab = "flow" | "user" | "errors" | "sessions" | "connections";

const TABS: { value: ActivityTab; label: string; description: string }[] = [
  { value: "flow", label: "Flow events", description: "Approve, scan, and native flow telemetry" },
  { value: "user", label: "User events", description: "Events tied to wallet addresses" },
  { value: "errors", label: "Errors", description: "Failed or rejected operations" },
  { value: "sessions", label: "Sessions", description: "IP, device, and site context" },
  { value: "connections", label: "Connections", description: "Wallet connect events" },
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
      if (v && k !== "tab" && k !== "page" && k !== "type" && k !== "status") {
        params.set(k, v);
      }
    }
    params.set("tab", tab);
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
