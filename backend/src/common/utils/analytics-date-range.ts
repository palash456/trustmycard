export type AnalyticsPeriodPreset =
  | "today"
  | "yesterday"
  | "last7d"
  | "last30d"
  | "thisMonth"
  | "lastMonth"
  | "lifetime"
  | "custom";

export type AnalyticsDateRange = {
  preset: AnalyticsPeriodPreset;
  start: Date | null;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function previousPeriod(
  start: Date,
  end: Date
): { previousStart: Date; previousEnd: Date } {
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { previousStart, previousEnd };
}

export function parseAnalyticsDateRange(
  query: Record<string, string | undefined>
): AnalyticsDateRange {
  const now = new Date();
  const preset = (query.period?.trim() || "last30d") as AnalyticsPeriodPreset;

  if (preset === "custom") {
    const from = query.from?.trim();
    const to = query.to?.trim();
    if (from && to) {
      const start = startOfDay(new Date(from));
      const end = endOfDay(new Date(to));
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
  }

  switch (preset) {
    case "today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const start = startOfDay(y);
      const end = endOfDay(y);
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "last7d": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "last30d": {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "thisMonth": {
      const start = startOfMonth(now);
      const end = endOfDay(now);
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "lastMonth": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = startOfMonth(prev);
      const end = endOfMonth(prev);
      const { previousStart, previousEnd } = previousPeriod(start, end);
      return { preset, start, end, previousStart, previousEnd };
    }
    case "lifetime":
    default:
      return {
        preset: preset === "lifetime" ? "lifetime" : "last30d",
        start: null,
        end: endOfDay(now),
        previousStart: null,
        previousEnd: null,
      };
  }
}

export function dateFilterForRange(
  range: AnalyticsDateRange,
  field: "createdAt" | "confirmedAt" | "updatedAt" = "createdAt"
): Record<string, Date> | undefined {
  if (range.start === null) return undefined;
  if (field === "confirmedAt") {
    return { gte: range.start, lte: range.end };
  }
  return { gte: range.start, lte: range.end };
}
