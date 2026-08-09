"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DATE_PRESET_OPTIONS,
  presetToSearchParams,
  resolveActivePreset,
  type DatePresetId,
} from "@/lib/analytics-date-presets";
import { cn } from "@/lib/utils";

export function AnalyticsDateRangeSelect({
  period,
  from,
  to,
}: {
  period: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const active = resolveActivePreset(period, from, to);
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");
  const [showCustom, setShowCustom] = useState(
    active.preset === "custom" && !from,
  );

  function apply(preset: DatePresetId) {
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const qs = presetToSearchParams(preset).toString();
    router.push(qs ? `/analytics?${qs}` : "/analytics");
    router.refresh();
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const qs = presetToSearchParams("custom", {
      from: customFrom,
      to: customTo,
    }).toString();
    router.push(`/analytics?${qs}`);
    router.refresh();
    setShowCustom(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium"
            />
          }
        >
          <CalendarDays className="size-3.5 opacity-70" />
          <span className="max-w-[160px] truncate">{active.label}</span>
          <ChevronDown className="size-3.5 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {DATE_PRESET_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => apply(opt.id)}
              className={cn(
                "text-xs",
                active.preset === opt.id && "bg-accent font-medium",
              )}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {showCustom || (period === "custom" && !from) ? (
        <div className="flex flex-wrap items-end justify-end gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
          <div className="grid gap-1">
            <Label
              htmlFor="analytics-from"
              className="text-[10px] text-muted-foreground"
            >
              From
            </Label>
            <Input
              id="analytics-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-[130px] text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label
              htmlFor="analytics-to"
              className="text-[10px] text-muted-foreground"
            >
              To
            </Label>
            <Input
              id="analytics-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-[130px] text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={applyCustom}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
