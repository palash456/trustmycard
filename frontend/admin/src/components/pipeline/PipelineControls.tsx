"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "approvals", label: "Approvals" },
  { value: "transfers", label: "Transfers" },
  { value: "native", label: "Native" },
] as const;

export type PipelineTab = (typeof TABS)[number]["value"];

export function PipelineTabsNav({
  activeTab,
  query,
}: {
  activeTab: PipelineTab;
  query: Record<string, string | undefined>;
}) {
  function href(tab: PipelineTab) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "tab" && k !== "page") params.set(k, v);
    }
    params.set("tab", tab);
    params.set("page", "1");
    const qs = params.toString();
    return qs ? `/pipeline?${qs}` : `/pipeline?tab=${tab}`;
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={href(tab.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function PipelineSearch({
  owner,
  tab,
  query,
}: {
  owner?: string;
  tab: PipelineTab;
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const value = String(data.get("owner") ?? "").trim();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "owner" && k !== "page") params.set(k, v);
    }
    params.set("tab", tab);
    if (value) params.set("owner", value);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  function clearSearch() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v && k !== "owner" && k !== "page" && k !== "tab") params.set(k, v);
    }
    params.set("tab", tab);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-1 flex-wrap items-center gap-2"
    >
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="owner"
          defaultValue={owner ?? ""}
          placeholder="Search by wallet address…"
          className="h-9 pl-9 font-mono text-xs"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary">
        Search
      </Button>
      {owner ? (
        <Button type="button" size="sm" variant="ghost" onClick={clearSearch}>
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </form>
  );
}
