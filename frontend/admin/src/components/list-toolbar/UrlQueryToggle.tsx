"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildUrlQueryParams, pushUrlQuery } from "@/lib/url-query-nav";
import { cn } from "@/lib/utils";

export function UrlQueryToggle({
  action,
  query,
  param,
  activeValue = "1",
  label,
  activeLabel,
}: {
  action: string;
  query: Record<string, string | undefined>;
  param: string;
  activeValue?: string;
  label: string;
  activeLabel: string;
}) {
  const router = useRouter();
  const active = query[param] === activeValue;

  function toggle() {
    const params = buildUrlQueryParams(query, {
      [param]: active ? null : activeValue,
    });
    pushUrlQuery(router, action, params);
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
      {active ? activeLabel : label}
    </Button>
  );
}
