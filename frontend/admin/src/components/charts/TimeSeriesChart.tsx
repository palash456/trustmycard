"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { nivoTheme } from "@/components/charts/chart-theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveLine = dynamic<any>(
  () => import("@nivo/line").then((m) => m.ResponsiveLine),
  { ssr: false }
);

export function TimeSeriesChart({
  title,
  description,
  data,
  className,
  yLabel = "Count",
  compact = false,
  bento = false,
}: {
  title: string;
  description?: string;
  data: Array<{ date: string; count: number }>;
  className?: string;
  yLabel?: string;
  compact?: boolean;
  bento?: boolean;
}) {
  const mode = bento ? "bento" : compact ? "compact" : "default";
  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const chartTheme = nivoTheme(isDark);

  if (data.length === 0) {
    return (
      <Card
        className={cn(
          "border-border/60 shadow-none",
          mode === "bento" && "flex h-full min-h-0 flex-col",
          className
        )}
      >
        <CardHeader
          className={cn(mode === "bento" ? "shrink-0 px-4 pb-0 pt-4" : "pb-2")}
        >
          <CardTitle
            className={cn(
              mode === "bento" ? "text-[11px] font-medium text-muted-foreground" : "text-base"
            )}
          >
            {title}
          </CardTitle>
          {description && mode !== "bento" ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className={cn(mode === "bento" && "px-4 pb-4 pt-3")}>
          <p className="text-xs text-muted-foreground">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  const series = [
    {
      id: yLabel,
      data: data.map((d) => ({ x: d.date, y: d.count })),
    },
  ];

  return (
    <Card
      className={cn(
        "border-border/60 shadow-none",
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
          mode === "bento" && "flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3",
          mode === "compact" && "h-[200px] pb-3 pt-0",
          mode === "default" && "h-[260px]"
        )}
      >
        <div className={cn(mode === "bento" && "h-full min-h-[200px] flex-1")}>
        <ResponsiveLine
          data={series}
          theme={chartTheme}
          margin={
            mode !== "default"
              ? { top: 12, right: 16, bottom: 36, left: 40 }
              : { top: 16, right: 24, bottom: 40, left: 48 }
          }
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: "auto", stacked: false }}
          axisBottom={{
            tickRotation: -35,
            legend: mode === "default" ? "Date" : undefined,
            legendOffset: 32,
            legendPosition: "middle",
          }}
          axisLeft={{
            legend: mode === "default" ? yLabel : undefined,
            legendOffset: -40,
            legendPosition: "middle",
          }}
          pointSize={mode !== "default" ? 4 : 6}
          pointBorderWidth={2}
          useMesh
          enableArea
          areaOpacity={0.12}
          colors={["#2563eb"]}
          curve="monotoneX"
        />
        </div>
      </CardContent>
    </Card>
  );
}

export function MultiLineTrendChart({
  title,
  description,
  series,
  className,
}: {
  title: string;
  description?: string;
  series: Array<{ id: string; data: Array<{ date: string; count: number }> }>;
  className?: string;
}) {
  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const chartTheme = nivoTheme(isDark);

  const nivoData = series.map((s) => ({
    id: s.id,
    data: s.data.map((d) => ({ x: d.date, y: d.count })),
  }));

  if (nivoData.every((s) => s.data.length === 0)) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveLine
          data={nivoData}
          theme={chartTheme}
          margin={{ top: 16, right: 24, bottom: 40, left: 48 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: "auto", stacked: false }}
          axisBottom={{ tickRotation: -35 }}
          pointSize={4}
          useMesh
          colors={{ scheme: "category10" }}
          curve="monotoneX"
        />
      </CardContent>
    </Card>
  );
}
