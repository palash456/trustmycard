import type { NetworkTokenAmount } from "@/types/analytics";

export function formatTokenAmounts(items: NetworkTokenAmount[], max = 3): string {
  if (!items.length) return "—";
  const shown = items.slice(0, max);
  const parts = shown.map((i) => {
    const amount = sanitizeMetricText(i.human);
    return `${i.network.toUpperCase()} ${i.tokenSymbol}: ${amount}`;
  });
  if (items.length > max) parts.push(`+${items.length - max} more`);
  return parts.join(" · ");
}

/** Clamp display strings so KPI tiles never spill into neighbors. */
export function sanitizeMetricText(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  if (!text) return "—";
  if (/^115792089237316195423570985008687907853269984665640564039457584007913129639935/.test(text)) {
    return "Unlimited";
  }
  if (text.length <= 22) return text;
  return `${text.slice(0, 19)}…`;
}

export function sumCollectionCount(items: NetworkTokenAmount[]): number {
  return items.reduce((s, i) => s + (i.count ?? 0), 0);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function healthLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}
