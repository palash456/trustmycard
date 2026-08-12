"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isStructuredLogExcludeNa } from "@/lib/transaction-id";
import { cn } from "@/lib/utils";

export function StructuredLogNaToggle({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const hideNa = isStructuredLogExcludeNa(query);

  function toggle() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (!value?.trim() || key === "excludeNa" || key === "page") continue;
      params.set(key, value.trim());
    }
    if (!hideNa) {
      params.set("excludeNa", "1");
    }
    const qs = params.toString();
    router.push(qs ? `/audit?${qs}` : "/audit");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={hideNa ? "default" : "outline"}
      size="sm"
      className={cn("h-8 px-2.5 text-xs font-medium")}
      onClick={toggle}
      aria-pressed={hideNa}
      title={
        hideNa
          ? "Showing logs with journey IDs only — click to include n/a rows"
          : "Including n/a journey rows — click to hide them"
      }
    >
      {hideNa ? "n/a hidden" : "Hide n/a"}
    </Button>
  );
}
