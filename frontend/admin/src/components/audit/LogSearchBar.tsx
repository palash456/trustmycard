"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function LogSearchBar({
  action,
  defaultValue,
  query,
  placeholder = "Search logs…",
  className,
}: {
  action: string;
  defaultValue?: string;
  query: Record<string, string | undefined>;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (
        v &&
        k !== "search" &&
        k !== "page" &&
        k !== "transactionId" &&
        k !== "sessionId" &&
        k !== "traceId"
      ) {
        params.set(k, v);
      }
    }
    const trimmed = value.trim();
    if (trimmed) params.set("search", trimmed);
    params.set("page", "1");
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn("flex w-full max-w-md gap-2", className)}
    >
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 text-xs"
        />
      </div>
      <Button type="submit" size="sm" className="h-8 text-xs">
        Search
      </Button>
    </form>
  );
}
