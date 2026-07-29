"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterField = {
  name: string;
  label: string;
  options?: readonly string[];
  placeholder?: string;
};

const selectClass = cn(
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
);

const RESERVED_PARAMS = new Set(["page", "limit"]);

function countActiveFilters(
  fields: FilterField[],
  values: Record<string, string | undefined>
): number {
  const fieldNames = new Set(fields.map((f) => f.name));
  let count = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!fieldNames.has(key) || RESERVED_PARAMS.has(key)) continue;
    if (value?.trim()) count += 1;
  }
  return count;
}

export function PageFilters({
  action,
  fields,
  values,
}: {
  action: string;
  fields: FilterField[];
  values: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const activeCount = useMemo(() => countActiveFilters(fields, values), [fields, values]);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
    router.refresh();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const fieldNames = new Set(fields.map((f) => f.name));

    // Preserve contextual params (tab, owner, etc.) not managed by filter fields
    for (const [key, value] of Object.entries(values)) {
      if (!fieldNames.has(key) && !RESERVED_PARAMS.has(key) && value?.trim()) {
        params.set(key, value.trim());
      }
    }

    for (const field of fields) {
      const raw = String(data.get(field.name) ?? "").trim();
      if (raw) params.set(field.name, raw);
    }

    params.set("page", "1");
    setOpen(false);
    navigate(params);
  }

  function clearFilters() {
    setOpen(false);
    const params = new URLSearchParams();
    const fieldNames = new Set(fields.map((f) => f.name));
    for (const [key, value] of Object.entries(values)) {
      if (!fieldNames.has(key) && !RESERVED_PARAMS.has(key) && value?.trim()) {
        params.set(key, value.trim());
      }
    }
    navigate(params);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
          />
        }
      >
        <ListFilter className="size-3.5 opacity-70" />
        Filters
        {activeCount > 0 ? (
          <Badge
            variant="secondary"
            className="h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold tabular-nums"
          >
            {activeCount}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6}>
        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-medium">Filters</p>
            {activeCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="size-3" />
                Clear all
              </Button>
            ) : null}
          </div>

          <div className="grid max-h-[min(60vh,420px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className="grid gap-1.5">
                <Label htmlFor={`filter-${field.name}`} className="text-[11px] text-muted-foreground">
                  {field.label}
                </Label>
                {field.options ? (
                  <select
                    id={`filter-${field.name}`}
                    name={field.name}
                    defaultValue={values[field.name] ?? ""}
                    className={selectClass}
                  >
                    <option value="">All</option>
                    {field.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`filter-${field.name}`}
                    name={field.name}
                    defaultValue={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs">
              Apply filters
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** @deprecated Use PageFilters in the page header toolbar instead. */
export function FilterForm(props: {
  action: string;
  fields: FilterField[];
  values: Record<string, string | undefined>;
}) {
  return <PageFilters {...props} />;
}
