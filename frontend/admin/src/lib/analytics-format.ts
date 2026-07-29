import type { NetworkTokenAmount } from "@/types/analytics";

export function formatTokenAmounts(items: NetworkTokenAmount[], max = 3): string {
  if (!items.length) return "—";
  const shown = items.slice(0, max);
  const parts = shown.map(
    (i) => `${i.network.toUpperCase()} ${i.tokenSymbol}: ${i.human}`
  );
  if (items.length > max) parts.push(`+${items.length - max} more`);
  return parts.join(" · ");
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
