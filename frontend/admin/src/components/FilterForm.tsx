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
  return (
    <Card className="mb-6 shadow-sm">
      <CardContent className="pt-6">
        <form method="get" action={action} className="flex flex-wrap items-end gap-4">
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
            <InfoTip text="Submits these fields as URL query params and reloads the list from the server (or demo fixtures). Empty fields mean “All”." />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
