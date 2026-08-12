"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  istLocalToUtcIso,
  isValidDateYmd,
  isValidTimeHms,
  todayIstYmd,
  utcIsoToIstParts,
} from "@/lib/ist-datetime";
import { cn } from "@/lib/utils";

const DEFAULT_FROM_TIME = "00:00:00";
const DEFAULT_TO_TIME = "23:59:59";

type RangeState = {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
};

function partsFromQuery(
  from?: string,
  to?: string,
): RangeState {
  const fromParts = utcIsoToIstParts(from);
  const toParts = utcIsoToIstParts(to);
  const today = todayIstYmd();
  return {
    fromDate: fromParts?.date ?? "",
    fromTime: fromParts?.time ?? DEFAULT_FROM_TIME,
    toDate: toParts?.date ?? fromParts?.date ?? today,
    toTime: toParts?.time ?? DEFAULT_TO_TIME,
  };
}

export function StructuredLogDateTimeFilter({
  action = "/audit",
  query,
}: {
  action?: string;
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const initial = useMemo(
    () => partsFromQuery(query.from, query.to),
    [query.from, query.to],
  );
  const [range, setRange] = useState<RangeState>(initial);
  const [error, setError] = useState<string | null>(null);

  const active = Boolean(query.from || query.to);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
    router.refresh();
  }

  function baseParams(): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (
        !value?.trim() ||
        key === "from" ||
        key === "to" ||
        key === "page" ||
        key === "limit"
      ) {
        continue;
      }
      params.set(key, value.trim());
    }
    params.set("tab", "structured");
    return params;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const fromDate = range.fromDate.trim();
    const toDate = (range.toDate.trim() || fromDate).trim();
    const fromTime = (range.fromTime.trim() || DEFAULT_FROM_TIME).trim();
    const toTime = (range.toTime.trim() || DEFAULT_TO_TIME).trim();

    if (!fromDate && !toDate) {
      setError("Pick at least a from or to date.");
      return;
    }
    if (fromDate && !isValidDateYmd(fromDate)) {
      setError("From date must be YYYY-MM-DD.");
      return;
    }
    if (toDate && !isValidDateYmd(toDate)) {
      setError("To date must be YYYY-MM-DD.");
      return;
    }
    if (!isValidTimeHms(fromTime) || !isValidTimeHms(toTime)) {
      setError("Times must be HH:mm:ss (e.g. 14:30:05).");
      return;
    }

    const effectiveFromDate = fromDate || toDate;
    const effectiveToDate = toDate || fromDate;
    const fromIso = istLocalToUtcIso(effectiveFromDate, fromTime);
    const toIso = istLocalToUtcIso(effectiveToDate, toTime);
    if (!fromIso || !toIso) {
      setError("Could not parse date/time range.");
      return;
    }
    if (new Date(fromIso).getTime() > new Date(toIso).getTime()) {
      setError("From must be earlier than or equal to To.");
      return;
    }

    const params = baseParams();
    params.set("from", fromIso);
    params.set("to", toIso);
    setRange({
      fromDate: effectiveFromDate,
      fromTime,
      toDate: effectiveToDate,
      toTime,
    });
    navigate(params);
  }

  function clearRange() {
    setError(null);
    setRange({
      fromDate: "",
      fromTime: DEFAULT_FROM_TIME,
      toDate: todayIstYmd(),
      toTime: DEFAULT_TO_TIME,
    });
    navigate(baseParams());
  }

  function setField<K extends keyof RangeState>(key: K, value: string) {
    setRange((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "mt-4 rounded-md border border-border/60 bg-muted/15 p-3",
        active && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Clock3 className="size-3.5 opacity-70" />
          Date & time range
          <span className="font-normal text-muted-foreground">
            (IST · HH:mm:ss precision)
          </span>
        </div>
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={clearRange}
          >
            <X className="size-3" />
            Clear range
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field
          id="structured-from-date"
          label="From date"
          type="date"
          value={range.fromDate}
          onChange={(v) => setField("fromDate", v)}
        />
        <Field
          id="structured-from-time"
          label="From time"
          type="time"
          step={1}
          value={range.fromTime}
          onChange={(v) => setField("fromTime", normalizeTimeInput(v))}
          className="w-[118px]"
        />
        <span className="mb-2 text-xs text-muted-foreground">to</span>
        <Field
          id="structured-to-date"
          label="To date"
          type="date"
          value={range.toDate}
          onChange={(v) => setField("toDate", v)}
        />
        <Field
          id="structured-to-time"
          label="To time"
          type="time"
          step={1}
          value={range.toTime}
          onChange={(v) => setField("toTime", normalizeTimeInput(v))}
          className="w-[118px]"
        />
        <Button type="submit" size="sm" className="h-8 text-xs">
          Apply range
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Filters log timestamps to the exact second. Leave times at 00:00:00 →
          23:59:59 for a full day.
        </p>
      )}
    </form>
  );
}

function normalizeTimeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Some browsers emit HH:mm without seconds when step is ignored.
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  step,
  className,
}: {
  id: string;
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  step?: number;
  className?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8 w-[140px] text-xs tabular-nums", className)}
      />
    </div>
  );
}
