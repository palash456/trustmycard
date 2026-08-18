"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildUrlQueryParams, pushUrlQuery } from "@/lib/url-query-nav";
import { cn } from "@/lib/utils";

export type UrlQuerySelectOption = {
  value: string;
  label: string;
};

export function UrlQuerySelect({
  action,
  query,
  param,
  label,
  options,
  icon: Icon,
  className,
}: {
  action: string;
  query: Record<string, string | undefined>;
  param: string;
  label: string;
  options: readonly UrlQuerySelectOption[];
  icon?: LucideIcon;
  className?: string;
}) {
  const router = useRouter();
  const current = query[param]?.trim();
  const active = options.find((opt) => opt.value === current);
  const triggerLabel = active?.label ?? label;

  function apply(value: string | null) {
    const params = buildUrlQueryParams(query, { [param]: value });
    pushUrlQuery(router, action, params);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-medium",
              active && "border-primary/40 bg-accent/40",
              className,
            )}
          />
        }
      >
        {Icon ? <Icon className="size-3.5 opacity-70" /> : null}
        <span className="max-w-[160px] truncate">{triggerLabel}</span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-72 w-52 overflow-y-auto"
      >
        <DropdownMenuItem
          onClick={() => apply(null)}
          className={cn("text-xs", !current && "bg-accent font-medium")}
        >
          All {label.toLowerCase()}
        </DropdownMenuItem>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => apply(opt.value)}
            className={cn(
              "text-xs",
              current === opt.value && "bg-accent font-medium",
            )}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
