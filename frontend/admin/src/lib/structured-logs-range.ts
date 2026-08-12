import {
  istLocalToUtcIso,
  isValidDateYmd,
  isValidTimeHms,
  todayIstYmd,
} from "@/lib/ist-datetime";

export const STRUCTURED_LOG_RANGE_PRESETS = [
  { id: "15m", label: "Last 15 minutes", ms: 15 * 60 * 1000 },
  { id: "1h", label: "Last 1 hour", ms: 60 * 60 * 1000 },
  { id: "6h", label: "Last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type StructuredLogRangePresetId =
  (typeof STRUCTURED_LOG_RANGE_PRESETS)[number]["id"];

export type StructuredLogRangeId = StructuredLogRangePresetId | "custom";

export const DEFAULT_STRUCTURED_LOG_RANGE: StructuredLogRangePresetId = "15m";

export type ResolvedStructuredLogRange = {
  rangeId: StructuredLogRangeId;
  from: string;
  to: string;
  label: string;
};

export function isStructuredLogRangePresetId(
  value: string | undefined,
): value is StructuredLogRangePresetId {
  return STRUCTURED_LOG_RANGE_PRESETS.some((p) => p.id === value);
}

/** Rolling preset window ending now (UTC ISO). */
export function presetStructuredLogRange(
  presetId: StructuredLogRangePresetId,
  now = new Date(),
): { from: string; to: string } {
  const preset = STRUCTURED_LOG_RANGE_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }
  const to = now;
  const from = new Date(to.getTime() - preset.ms);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function resolveStructuredLogRangeId(
  query: Record<string, string | undefined>,
): StructuredLogRangeId | null {
  if (query.range === "custom") return "custom";
  if (isStructuredLogRangePresetId(query.range)) return query.range;
  if (query.from && query.to) return "custom";
  return null;
}

/** Resolve the active backend filter window. Returns null if range is not yet valid. */
export function resolveStructuredLogTimeRange(
  query: Record<string, string | undefined>,
  now = new Date(),
): ResolvedStructuredLogRange | null {
  const rangeId = resolveStructuredLogRangeId(query);

  if (rangeId === "custom") {
    if (!query.from?.trim() || !query.to?.trim()) return null;
    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
    return {
      rangeId: "custom",
      from: query.from,
      to: query.to,
      label: "Custom range",
    };
  }

  if (rangeId && isStructuredLogRangePresetId(rangeId)) {
    const preset = STRUCTURED_LOG_RANGE_PRESETS.find((p) => p.id === rangeId)!;
    const { from, to } = presetStructuredLogRange(rangeId, now);
    return { rangeId, from, to, label: preset.label };
  }

  return null;
}

export function getStructuredLogFetchWindow(
  range: ResolvedStructuredLogRange,
  now = new Date(),
): { from: string; to: string } {
  if (range.rangeId === "custom") {
    return { from: range.from, to: range.to };
  }
  return presetStructuredLogRange(range.rangeId, now);
}

export function structuredLogRangeLabel(
  rangeId: StructuredLogRangeId | null | undefined,
): string {
  if (!rangeId) return "Select range";
  if (rangeId === "custom") return "Custom date & time";
  return (
    STRUCTURED_LOG_RANGE_PRESETS.find((p) => p.id === rangeId)?.label ??
    "Select range"
  );
}

export function buildStructuredLogRangeParams(
  query: Record<string, string | undefined>,
  rangeId: StructuredLogRangeId,
  custom?: { from: string; to: string },
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (
      !value?.trim() ||
      key === "range" ||
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
  params.set("range", rangeId);
  if (rangeId === "custom" && custom) {
    params.set("from", custom.from);
    params.set("to", custom.to);
  }
  return params;
}

export function parseCustomStructuredLogRange(input: {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
}):
  | { ok: true; from: string; to: string }
  | { ok: false; error: string } {
  const fromDate = input.fromDate.trim();
  const toDate = (input.toDate.trim() || fromDate).trim();
  const fromTime = (input.fromTime.trim() || "00:00:00").trim();
  const toTime = (input.toTime.trim() || "23:59:59").trim();

  if (!fromDate || !toDate) {
    return { ok: false, error: "Pick from and to dates." };
  }
  if (!isValidDateYmd(fromDate) || !isValidDateYmd(toDate)) {
    return { ok: false, error: "Dates must be YYYY-MM-DD." };
  }
  if (!isValidTimeHms(fromTime) || !isValidTimeHms(toTime)) {
    return { ok: false, error: "Times must be HH:mm:ss." };
  }

  const from = istLocalToUtcIso(fromDate, fromTime);
  const to = istLocalToUtcIso(toDate, toTime);
  if (!from || !to) {
    return { ok: false, error: "Could not parse custom range." };
  }
  if (new Date(from).getTime() > new Date(to).getTime()) {
    return { ok: false, error: "From must be earlier than or equal to To." };
  }
  return { ok: true, from, to };
}

export function defaultCustomRangeDraft() {
  const today = todayIstYmd();
  return {
    fromDate: today,
    fromTime: "00:00:00",
    toDate: today,
    toTime: "23:59:59",
  };
}
