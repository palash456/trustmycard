"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/InfoTip";
import { cn } from "@/lib/utils";

const selectClass = cn(
  "flex h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
);

export function FilterForm({
  action,
  fields,
  values,
}: {
  action: string;
  fields: Array<{ name: string; label: string; options?: string[] }>;
  values: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();

    for (const field of fields) {
      const raw = String(data.get(field.name) ?? "").trim();
      if (raw) params.set(field.name, raw);
    }

    params.set("page", "1");
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
    router.refresh();
  }

  return (
    <Card className="mb-6 shadow-sm">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
          {fields.map((field) => (
            <div key={field.name} className="grid min-w-[140px] gap-2">
              <Label htmlFor={field.name} className="text-xs text-muted-foreground">
                {field.label}
              </Label>
              {field.options ? (
                <select
                  id={field.name}
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
                  id={field.name}
                  name={field.name}
                  defaultValue={values[field.name] ?? ""}
                  className="h-9"
                />
              )}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="secondary" className="h-9">
              Apply filters
            </Button>
            <InfoTip text="Updates URL query params and reloads the list. Empty fields are omitted. Resets to page 1." />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
