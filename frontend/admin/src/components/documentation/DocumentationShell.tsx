"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { DocumentationContent } from "@/components/documentation/DocumentationContent";
import { DocumentationNav } from "@/components/documentation/DocumentationNav";
import { DocumentationToc } from "@/components/documentation/DocumentationToc";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { buildTocEntries } from "@/lib/documentation/registry";
import type { DocPage } from "@/lib/documentation/types";

export function DocumentationShell({ page }: { page: DocPage }) {
  const tocEntries = buildTocEntries(page);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="-mx-4 -mt-5 flex min-h-[calc(100vh-3.5rem)] flex-col md:-mx-6 lg:-mx-8">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-card/50">
        <div className="hidden w-64 shrink-0 border-r border-border/60 bg-sidebar/30 md:block lg:w-72">
          <DocumentationNav activeSlug={page.slug} className="h-full" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Menu className="size-4" />
                    Topics
                  </Button>
                }
              />
              <SheetContent
                side="left"
                className="w-[min(100vw-2rem,20rem)] p-0"
              >
                <SheetHeader className="border-b border-border/60 px-4 py-3">
                  <SheetTitle className="text-left text-sm">
                    Documentation
                  </SheetTitle>
                </SheetHeader>
                <DocumentationNav
                  activeSlug={page.slug}
                  className="h-[calc(100vh-4rem)]"
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-medium text-muted-foreground">
              {page.title}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-6xl gap-8 px-5 py-8 lg:px-10">
              <DocumentationContent page={page} />
              <DocumentationToc
                entries={tocEntries}
                className="w-48 shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
