"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  utcIsoToIstParts,
} from "@/lib/ist-datetime";
import {
  buildStructuredLogRangeParams,
  defaultCustomRangeDraft,
  parseCustomStructuredLogRange,
  resolveStructuredLogRangeId,
  STRUCTURED_LOG_RANGE_PRESETS,
  structuredLogRangeLabel,
  type StructuredLogRangeId,
} from "@/lib/structured-logs-range";
import { cn } from "@/lib/utils";

function normalizeTimeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

export function StructuredLogTimeRangeSelect({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const activeRangeId = resolveStructuredLogRangeId(query);
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customDraft = useMemo(() => {
    if (query.range === "custom" && query.from && query.to) {
      const fromParts = utcIsoToIstParts(query.from);
      const toParts = utcIsoToIstParts(query.to);
      if (fromParts && toParts) {
        return {
          fromDate: fromParts.date,
          fromTime: fromParts.time,
          toDate: toParts.date,
          toTime: toParts.time,
        };
      }
    }
    return defaultCustomRangeDraft();
  }, [query.from, query.range, query.to]);

  const [fromDate, setFromDate] = useState(customDraft.fromDate);
  const [fromTime, setFromTime] = useState(customDraft.fromTime);
  const [toDate, setToDate] = useState(customDraft.toDate);
  const [toTime, setToTime] = useState(customDraft.toTime);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/audit?${qs}` : "/audit");
    router.refresh();
  }

  function applyPreset(rangeId: StructuredLogRangeId) {
    setError(null);
    if (rangeId === "custom") {
      setFromDate(customDraft.fromDate);
      setFromTime(customDraft.fromTime);
      setToDate(customDraft.toDate);
      setToTime(customDraft.toTime);
      setCustomOpen(true);
      return;
    }
    navigate(buildStructuredLogRangeParams(query, rangeId));
  }

  function applyCustom() {
    setError(null);
    const parsed = parseCustomStructuredLogRange({
      fromDate,
      fromTime,
      toDate,
      toTime,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setCustomOpen(false);
    navigate(
      buildStructuredLogRangeParams(query, "custom", {
        from: parsed.from,
        to: parsed.to,
      }),
    );
  }

  return (
    <>
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
          <CalendarClock className="size-3.5 opacity-70" />
          <span className="max-w-[180px] truncate">
            {structuredLogRangeLabel(activeRangeId)}
          </span>
          <ChevronDown className="size-3.5 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {STRUCTURED_LOG_RANGE_PRESETS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => applyPreset(opt.id)}
              className={cn(
                "text-xs",
                activeRangeId === opt.id && "bg-accent font-medium",
              )}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => applyPreset("custom")}
            className={cn(
              "text-xs",
              activeRangeId === "custom" && "bg-accent font-medium",
            )}
          >
            Custom date & time (IST)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={customOpen} onOpenChange={setCustomOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Custom log range</SheetTitle>
            <SheetDescription>
              Filter structured logs to an exact IST date and time window
              (HH:mm:ss).
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 bg-muted/15 p-3">
              <Field
                id="range-from-date"
                label="From date"
                type="date"
                value={fromDate}
                onChange={setFromDate}
              />
              <Field
                id="range-from-time"
                label="From time"
                type="time"
                value={fromTime}
                onChange={(v) => setFromTime(normalizeTimeInput(v))}
              />
              <Field
                id="range-to-date"
                label="To date"
                type="date"
                value={toDate}
                onChange={setToDate}
              />
              <Field
                id="range-to-time"
                label="To time"
                type="time"
                value={toTime}
                onChange={(v) => setToTime(normalizeTimeInput(v))}
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="button"
              className="mt-auto h-9 text-xs"
              onClick={applyCustom}
            >
              Apply custom range
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        step={type === "time" ? 1 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs tabular-nums"
      />
    </div>
  );
}
