import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  function href(p: number) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v) q.set(k, v);
    }
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  }

  const btn = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex items-center justify-between gap-4 pt-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <span className={cn(btn, "pointer-events-none opacity-50")}>
            <ChevronLeft className="size-4" />
            Previous
          </span>
        ) : (
          <Link href={href(prev)} className={btn}>
            <ChevronLeft className="size-4" />
            Previous
          </Link>
        )}
        {page >= totalPages ? (
          <span className={cn(btn, "pointer-events-none opacity-50")}>
            Next
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link href={href(next)} className={btn}>
            Next
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
