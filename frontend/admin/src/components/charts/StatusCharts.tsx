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
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  className?: string;
}) {
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
    <Card className={cn("border-border/80 bg-card shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative mx-auto h-[240px] w-full min-w-0 lg:max-w-[240px]">
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
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {total.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
              </div>
            </div>
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
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  className?: string;
  layout?: "horizontal" | "vertical";
  compact?: boolean;
}) {
  const chartTheme = useChartTheme();
  const rows = toChartData(data);
  const barData = rows.map((row, i) => ({
    name: row.name,
    value: row.value,
    color: colorFor(row.name, i),
  }));

  return (
    <Card className={cn("border-border/80 bg-card shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-base", compact && "text-sm font-medium")}>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        ) : (
          <div className={cn("w-full min-w-0", layout === "horizontal" ? "h-[280px]" : "h-[220px]")}>
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
      className="mb-6"
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
