"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TransactionCompletedOnlyToggle({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const active = query.completedOnly === "1";

  function toggle() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (!value?.trim() || key === "completedOnly" || key === "page") continue;
      params.set(key, value.trim());
    }
    if (!active) {
      params.set("completedOnly", "1");
    }
    const qs = params.toString();
    router.push(qs ? `/transactions?${qs}` : "/transactions");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className={cn("h-8 px-2.5 text-xs font-medium")}
      onClick={toggle}
      aria-pressed={active}
    >
      {active ? "Completed with collection" : "Show completed only"}
    </Button>
  );
}
