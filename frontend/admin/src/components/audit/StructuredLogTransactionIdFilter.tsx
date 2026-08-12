"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Hash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function activeTransactionId(
  query: Record<string, string | undefined>,
): string {
  return (
    query.transactionId?.trim() ||
    query.sessionId?.trim() ||
    query.traceId?.trim() ||
    ""
  );
}

export function StructuredLogTransactionIdFilter({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(activeTransactionId(query));
  const applied = activeTransactionId(query);

  function buildParams(nextTransactionId?: string): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      const v = raw?.trim();
      if (
        !v ||
        key === "transactionId" ||
        key === "sessionId" ||
        key === "traceId" ||
        key === "page" ||
        key === "limit"
      ) {
        continue;
      }
      params.set(key, v);
    }
    const tx = nextTransactionId?.trim();
    if (tx) params.set("transactionId", tx);
    return params;
  }

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/audit?${qs}` : "/audit?tab=structured&range=15m");
    router.refresh();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(buildParams(value));
  }

  function clear() {
    setValue("");
    navigate(buildParams());
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2",
        applied && "border-primary/40 bg-primary/5",
      )}
    >
      <Hash className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Transaction ID (flow-…)"
        className="h-8 min-w-[200px] flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
      />
      <Button type="submit" size="sm" className="h-8 text-xs">
        Apply
      </Button>
      {applied ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={clear}
        >
          <X className="size-3" />
          Clear
        </Button>
      ) : null}
    </form>
  );
}
