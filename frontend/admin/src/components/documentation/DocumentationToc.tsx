"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TocEntry } from "@/lib/documentation/types";
import { useActiveDocSection } from "./DocumentationNav";

export function DocumentationToc({
  entries,
  className,
}: {
  entries: TocEntry[];
  className?: string;
}) {
  const sectionIds = entries.map((entry) => entry.id);
  const activeId = useActiveDocSection(sectionIds);

  if (entries.length === 0) return null;

  return (
    <aside className={cn("hidden xl:block", className)}>
      <div className="sticky top-4">
        <p className="mb-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
          On this page
        </p>
        <nav>
          <ul className="space-y-1 border-l border-border/60">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`#${entry.id}`}
                  className={cn(
                    "block border-l-2 py-1 text-sm transition-colors",
                    entry.level === 3 ? "pl-5" : "pl-3",
                    activeId === entry.id
                      ? "border-primary font-medium text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
