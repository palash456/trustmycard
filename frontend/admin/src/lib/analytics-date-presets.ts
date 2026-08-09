export type DatePresetId =
  | "today"
  | "yesterday"
  | "last7d"
  | "last30d"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "lifetime"
  | "custom";

export const DATE_PRESET_OPTIONS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7d", label: "Last 7 days" },
  { id: "last30d", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisQuarter", label: "This quarter" },
  { id: "thisYear", label: "This year" },
  { id: "lifetime", label: "Lifetime" },
  { id: "custom", label: "Custom range" },
];

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Maps UI preset to URL search params (no backend changes — quarter/year use custom range). */
export function presetToSearchParams(
  preset: DatePresetId,
  custom?: { from: string; to: string },
): URLSearchParams {
  const now = new Date();
  const params = new URLSearchParams();

  if (preset === "custom") {
    if (custom?.from && custom?.to) {
      params.set("period", "custom");
      params.set("from", custom.from);
      params.set("to", custom.to);
    } else {
      params.set("period", "custom");
    }
    return params;
  }

  if (preset === "thisQuarter") {
    const q = Math.floor(now.getMonth() / 3);
    params.set("period", "custom");
    params.set("from", fmt(startOfDay(new Date(now.getFullYear(), q * 3, 1))));
    params.set("to", fmt(endOfDay(now)));
    return params;
  }

  if (preset === "thisYear") {
    params.set("period", "custom");
    params.set("from", fmt(startOfDay(new Date(now.getFullYear(), 0, 1))));
    params.set("to", fmt(endOfDay(now)));
    return params;
  }

  params.set("period", preset);
  return params;
}

export function resolveActivePreset(
  period: string,
  from?: string,
  to?: string,
): { preset: DatePresetId; label: string } {
  if (period === "custom" && from && to) {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const qStart = fmt(startOfDay(new Date(now.getFullYear(), q * 3, 1)));
    const yStart = fmt(startOfDay(new Date(now.getFullYear(), 0, 1)));
    const today = fmt(endOfDay(now));
    if (from === qStart && to === today) {
      return { preset: "thisQuarter", label: "This quarter" };
    }
    if (from === yStart && to === today) {
      return { preset: "thisYear", label: "This year" };
    }
    return { preset: "custom", label: `${from} → ${to}` };
  }

  const match = DATE_PRESET_OPTIONS.find((o) => o.id === period);
  if (match) return { preset: match.id, label: match.label };
  return { preset: "last30d", label: "Last 30 days" };
}
