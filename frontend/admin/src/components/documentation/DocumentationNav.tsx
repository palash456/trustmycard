"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DOC_NAV_GROUPS, DOC_PAGES } from "@/lib/documentation/registry";
import { searchDocumentation } from "@/lib/documentation/search";

export function DocumentationNav({
  activeSlug,
  className,
  onNavigate,
}: {
  activeSlug: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchDocumentation(query, DOC_PAGES, DOC_NAV_GROUPS),
    [query]
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="shrink-0 border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documentation…"
            className="h-9 bg-background pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {query.trim() ? (
            <SearchResults
              results={results}
              query={query}
              onSelect={() => {
                setQuery("");
                onNavigate?.();
              }}
            />
          ) : (
            <NavTree activeSlug={activeSlug} onNavigate={onNavigate} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function NavTree({
  activeSlug,
  onNavigate,
}: {
  activeSlug: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-4">
      {DOC_NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.slug === activeSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/documentation/${item.slug}`}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SearchResults({
  results,
  query,
  onSelect,
}: {
  results: ReturnType<typeof searchDocumentation>;
  query: string;
  onSelect: () => void;
}) {
  if (results.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        No results for &ldquo;{query}&rdquo;
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {results.map((result, index) => (
        <li key={`${result.slug}-${result.match}-${index}`}>
          <Link
            href={`/documentation/${result.slug}${result.sectionId ? `#${result.sectionId}` : ""}`}
            onClick={onSelect}
            className="block rounded-md px-2 py-2 hover:bg-muted"
          >
            <p className="text-sm font-medium text-foreground">{result.title}</p>
            <p className="text-xs text-muted-foreground">
              {result.group}
              {result.sectionTitle ? ` · ${result.sectionTitle}` : ""}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function useActiveDocSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | undefined>(sectionIds[0]);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
