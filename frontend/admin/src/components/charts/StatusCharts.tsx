"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { nivoTheme } from "@/components/charts/chart-theme";

const ResponsivePie = dynamic(
  () => import("@nivo/pie").then((m) => m.ResponsivePie),
  { ssr: false }
);

const ResponsiveBar = dynamic(
  () => import("@nivo/bar").then((m) => m.ResponsiveBar),
  { ssr: false }
);

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  SUBMITTED: "#3b82f6",
  PARTIALLY_USED: "#f59e0b",
  COMPLETED: "#64748b",
  REVOKED: "#ef4444",
  EXPIRED: "#94a3b8",
  FAILED: "#dc2626",
  SUPERSEDED: "#78716c",
  confirmed: "#10b981",
  pending: "#f59e0b",
  broadcast: "#6366f1",
  prepared: "#94a3b8",
  failed: "#ef4444",
  scan: "#8b5cf6",
  approve: "#3b82f6",
  native_transfer: "#14b8a6",
  connect: "#64748b",
  success: "#10b981",
  error: "#ef4444",
  pol: "#8247e5",
  eth: "#627eea",
  bsc: "#f0b90b",
  tron: "#ef0027",
  arb: "#28a0f0",
  base: "#0052ff",
};

const FALLBACK = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

function colorFor(key: string, index: number): string {
  return STATUS_COLORS[key] ?? FALLBACK[index % FALLBACK.length];
}

function toChartData(data: Record<string, number>) {
  return Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function useChartTheme() {
  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  return nivoTheme(isDark);
}

export function StatusDonutChart({
  title,
  description,
  data,
  className,
  compact = false,
  bento = false,
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  className?: string;
  compact?: boolean;
  bento?: boolean;
}) {
  const mode = bento ? "bento" : compact ? "compact" : "default";
  const chartTheme = useChartTheme();
  const rows = toChartData(data);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const pieData = rows.map((row, i) => ({
    id: row.name,
    label: row.name,
    value: row.value,
    color: colorFor(row.name, i),
  }));

  return (
    <Card
      className={cn(
        "border-border/60 bg-card shadow-none",
        mode === "bento" && "flex h-full min-h-0 flex-col",
        className
      )}
    >
      <CardHeader
        className={cn(
          mode === "bento" ? "shrink-0 space-y-0 px-4 pb-0 pt-4" : "pb-2",
          mode === "compact" && "py-3"
        )}
      >
        <CardTitle
          className={cn(
            mode === "bento" && "text-[11px] font-medium text-muted-foreground",
            mode === "compact" && "text-sm font-semibold",
            mode === "default" && "text-base"
          )}
        >
          {title}
        </CardTitle>
        {description && mode !== "bento" ? (
          <CardDescription className={mode === "compact" ? "text-xs" : undefined}>
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          mode === "bento" && "flex min-h-0 flex-1 flex-col justify-center px-4 pb-4 pt-3",
          mode === "compact" && "pb-3 pt-0"
        )}
      >
        {rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No data</p>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-3",
              mode === "default" && "lg:flex-row lg:items-center",
              mode === "bento" && "items-center"
            )}
          >
            <div
              className={cn(
                "relative mx-auto w-full min-w-0",
                mode === "bento" && "h-[128px] max-w-[128px]",
                mode === "compact" && "h-[160px] max-w-[160px]",
                mode === "default" && "h-[240px] lg:max-w-[240px]"
              )}
            >
              <ResponsivePie
                data={pieData}
                theme={chartTheme}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                innerRadius={0.72}
                padAngle={2.5}
                cornerRadius={6}
                activeOuterRadiusOffset={10}
                borderWidth={0}
                colors={{ datum: "data.color" }}
                enableArcLinkLabels={false}
                arcLabelsSkipAngle={12}
                arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2.4]] }}
                motionConfig="gentle"
                tooltip={({ datum }) => (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-foreground">{datum.label}</p>
                    <p className="text-muted-foreground">
                      {datum.value.toLocaleString()} records
                    </p>
                  </div>
                )}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p
                  className={cn(
                    "font-semibold tabular-nums text-foreground",
                    mode === "bento" ? "text-base" : mode === "compact" ? "text-lg" : "text-2xl"
                  )}
                >
                  {total.toLocaleString()}
                </p>
                {mode !== "bento" ? (
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                ) : null}
              </div>
            </div>
            {mode === "default" ? (
            <ul className="min-w-0 flex-1 space-y-2">
              {rows.map((row, i) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: colorFor(row.name, i) }}
                    />
                    <span className="truncate font-medium text-foreground">{row.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                    {row.value.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            ) : (
              <ul
                className={cn(
                  "flex w-full flex-wrap justify-center gap-x-4 gap-y-1.5",
                  mode === "bento" ? "max-w-sm" : "max-w-xs"
                )}
              >
                {rows.map((row, i) => (
                  <li key={row.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(row.name, i) }}
                    />
                    <span className="truncate">{row.name}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {row.value.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusBarChart({
  title,
  description,
  data,
  className,
  layout = "horizontal",
  compact = false,
  bento = false,
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  className?: string;
  layout?: "horizontal" | "vertical";
  compact?: boolean;
  bento?: boolean;
}) {
  const mode = bento ? "bento" : compact ? "compact" : "default";
  const chartTheme = useChartTheme();
  const rows = toChartData(data);
  const barData = rows.map((row, i) => ({
    name: row.name,
    value: row.value,
    color: colorFor(row.name, i),
  }));

  return (
    <Card
      className={cn(
        "border-border/60 bg-card shadow-none",
        mode === "bento" && "flex h-full min-h-0 flex-col",
        className
      )}
    >
      <CardHeader
        className={cn(
          mode === "bento" ? "shrink-0 space-y-0 px-4 pb-0 pt-4" : "pb-2",
          mode === "compact" && "py-3"
        )}
      >
        <CardTitle
          className={cn(
            mode === "bento" && "text-[11px] font-medium text-muted-foreground",
            mode === "compact" && "text-sm font-medium",
            mode === "default" && "text-base"
          )}
        >
          {title}
        </CardTitle>
        {description && mode !== "bento" ? (
          <CardDescription className={mode === "compact" ? "text-xs" : undefined}>
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(mode === "bento" && "flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3")}
      >
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        ) : (
          <div
            className={cn(
              "w-full min-w-0",
              mode === "bento" && "h-full min-h-[160px] flex-1",
              mode === "compact" &&
                (layout === "horizontal" ? "h-[200px]" : "h-[180px]"),
              mode === "default" &&
                (layout === "horizontal" ? "h-[280px]" : "h-[220px]")
            )}
          >
            <ResponsiveBar
              data={barData}
              keys={["value"]}
              indexBy="name"
              theme={chartTheme}
              layout={layout}
              margin={
                layout === "horizontal"
                  ? { top: 8, right: 16, bottom: 8, left: 96 }
                  : { top: 8, right: 12, bottom: 56, left: 12 }
              }
              padding={layout === "horizontal" ? 0.35 : 0.45}
              valueScale={{ type: "linear" }}
              indexScale={{ type: "band", round: true }}
              colors={(bar) => String((bar.data as { color: string }).color)}
              borderRadius={layout === "horizontal" ? 6 : 8}
              enableGridX={false}
              enableGridY={false}
              axisTop={null}
              axisRight={null}
              axisBottom={
                layout === "vertical"
                  ? {
                      tickSize: 0,
                      tickPadding: 8,
                      tickRotation: -24,
                    }
                  : null
              }
              axisLeft={
                layout === "horizontal"
                  ? {
                      tickSize: 0,
                      tickPadding: 8,
                    }
                  : null
              }
              labelSkipWidth={24}
              labelSkipHeight={16}
              labelTextColor={{ from: "color", modifiers: [["darker", 2.6]] }}
              motionConfig="gentle"
              role="img"
              ariaLabel={title}
              tooltip={({ indexValue, value, color }) => (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold text-foreground">{indexValue}</p>
                  <p className="text-muted-foreground">
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                    {Number(value).toLocaleString()} records
                  </p>
                </div>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ListStatusMiniChart({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const rows = toChartData(data);
  if (rows.length === 0) return null;

  return (
    <StatusBarChart
      title={title}
      description="From current filter results"
      data={data}
      layout="vertical"
      compact
      className="mb-0"
    />
  );
}

export function countByField<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = String(item[field] ?? "unknown");
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
