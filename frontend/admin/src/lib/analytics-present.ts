import type { AnalyticsResponse, NetworkTokenAmount } from "@/types/analytics";

export type AssetBreakdown = {
  id: string;
  label: string;
  human: string;
  collections: number;
  share: number;
};

const STABLE_ORDER = ["USDT", "USDC"];
const NATIVE_ORDER = ["ETH", "BNB", "POL", "MATIC", "TRX", "AVAX"];

function formatShare(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Group lifetime collected stablecoin rows by token symbol. */
export function aggregateStablecoinAssets(
  items: NetworkTokenAmount[]
): AssetBreakdown[] {
  const map = new Map<string, { raw: bigint; count: number; decimals: number }>();
  for (const item of items) {
    const key = item.tokenSymbol.toUpperCase();
    const existing = map.get(key);
    const raw = BigInt(item.raw || "0");
    if (existing) {
      map.set(key, {
        raw: existing.raw + raw,
        count: existing.count + (item.count ?? 0),
        decimals: item.decimals,
      });
    } else {
      map.set(key, { raw, count: item.count ?? 0, decimals: item.decimals });
    }
  }

  const rows = [...map.entries()].map(([symbol, v]) => {
    const human = formatHumanFromRaw(v.raw.toString(), v.decimals);
    return { id: symbol, label: symbol, human, collections: v.count };
  });

  rows.sort((a, b) => {
    const ai = STABLE_ORDER.indexOf(a.id);
    const bi = STABLE_ORDER.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.collections - a.collections;
  });

  const totalCollections = rows.reduce((s, r) => s + r.collections, 0);
  return rows.map((r) => ({
    ...r,
    share: formatShare(r.collections, totalCollections),
  }));
}

function formatHumanFromRaw(raw: string, decimals: number): string {
  try {
    const value = BigInt(raw || "0");
    if (value === BigInt(0)) return "0";
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    if (frac === BigInt(0)) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return raw;
  }
}

/** Native funding volume by asset symbol (operational, not stablecoin revenue). */
export function aggregateNativeAssets(
  data: AnalyticsResponse
): AssetBreakdown[] {
  const map = new Map<string, number>();
  for (const row of data.tokens.native.volume) {
    const sym = (row.assetSymbol ?? "NATIVE").toUpperCase();
    map.set(sym, (map.get(sym) ?? 0) + (row.count ?? 0));
  }
  const rows = [...map.entries()].map(([symbol, count]) => ({
    id: symbol,
    label: symbol === "POL" ? "MATIC" : symbol,
    human: `${count} txs`,
    collections: count,
  }));
  rows.sort((a, b) => {
    const ai = NATIVE_ORDER.indexOf(a.id);
    const bi = NATIVE_ORDER.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    return b.collections - a.collections;
  });
  const total = rows.reduce((s, r) => s + r.collections, 0);
  return rows.map((r) => ({ ...r, share: formatShare(r.collections, total) }));
}

export function buildLifetimeAssetCards(data: AnalyticsResponse): AssetBreakdown[] {
  const stables = aggregateStablecoinAssets(data.revenue.collected.lifetime);
  const natives = aggregateNativeAssets(data);
  return [...stables, ...natives];
}

export function revenueDistributionChartData(
  assets: AssetBreakdown[]
): Record<string, number> {
  return Object.fromEntries(
    assets.filter((a) => a.collections > 0).map((a) => [a.label, a.collections])
  );
}

export function revenueByChainChart(data: AnalyticsResponse): Record<string, number> {
  const out: Record<string, number> = {};
  for (const chain of data.chains) {
    const vol = chain.revenue.reduce((s, r) => s + (r.count ?? 0), 0);
    if (vol > 0) out[chain.network.toUpperCase()] = vol;
  }
  return out;
}

export function revenueByTokenChart(data: AnalyticsResponse): Record<string, number> {
  return {
    USDT: data.tokens.usdt.collections,
    USDC: data.tokens.usdc.collections,
  };
}

export function revenueFunnelChart(data: AnalyticsResponse): Record<string, number> {
  const c = data.approvals.counts;
  return {
    Submitted: c.SUBMITTED ?? 0,
    Active: c.ACTIVE ?? 0,
    "Partially used": c.PARTIALLY_USED ?? 0,
    Completed: c.COMPLETED ?? 0,
  };
}

export function revenueLossChart(data: AnalyticsResponse): Record<string, number> {
  return {
    Pending: data.revenue.pending.reduce((s, p) => s + (p.count ?? 1), 0),
    Failed: data.revenue.failed.reduce((s, p) => s + (p.count ?? 1), 0),
    Lost: data.revenue.lost.reduce((s, p) => s + (p.count ?? 1), 0),
    Recoverable: data.revenue.recoverable.reduce((s, p) => s + (p.count ?? 1), 0),
  };
}

export function chainCollectionsChart(data: AnalyticsResponse): Record<string, number> {
  return Object.fromEntries(
    data.chains.map((c) => [c.network.toUpperCase(), c.collections])
  );
}

export function chainUsersChart(data: AnalyticsResponse): Record<string, number> {
  return Object.fromEntries(data.chains.map((c) => [c.network.toUpperCase(), c.wallets]));
}

export function chainApprovalRateChart(data: AnalyticsResponse): Record<string, number> {
  return Object.fromEntries(
    data.chains.map((c) => [c.network.toUpperCase(), c.successRate])
  );
}

export function tokenPerChainChart(data: AnalyticsResponse): Record<string, number> {
  const out: Record<string, number> = {};
  for (const chain of data.chains) {
    for (const row of chain.revenue) {
      const key = `${chain.network.toUpperCase()} ${row.tokenSymbol}`;
      out[key] = (out[key] ?? 0) + (row.count ?? 0);
    }
  }
  return out;
}

export function userWorkflowChart(data: AnalyticsResponse): Record<string, number> {
  const w = data.users.workflowStages;
  return {
    "Waiting approval": w.waitingForApproval,
    "Ready to collect": w.readyForCollection,
    Collecting: w.currentlyCollecting,
    Completed: w.successfullyCompleted,
    Failed: w.failed,
  };
}

export function newVsReturningChart(data: AnalyticsResponse): Record<string, number> {
  return {
    New: data.users.newInPeriod,
    Returning: data.users.returningInPeriod,
    Active: data.users.activeWallets,
    Abandoned: data.users.abandonedWallets,
  };
}

export function latencyChart(data: AnalyticsResponse): Record<string, number> {
  const p = data.performance;
  const out: Record<string, number> = {};
  if (p.connectToApprovalMs != null) out["Connect → approval"] = p.connectToApprovalMs;
  if (p.approvalToCollectionMs != null) out["Approval → collection"] = p.approvalToCollectionMs;
  if (p.collectionToConfirmationMs != null) out["Collection → confirm"] = p.collectionToConfirmationMs;
  if (p.averageLifecycleMs != null) out["Full lifecycle"] = p.averageLifecycleMs;
  return out;
}

export function failureCategoryChart(data: AnalyticsResponse): Record<string, number> {
  return {
    RPC: data.failures.rpcFailures,
    Timeout: data.failures.timeoutFailures,
    Unknown: data.failures.unknownErrors,
  };
}

export function collectionsPerUser(data: AnalyticsResponse): string {
  const owners = data.revenue.averages.perUser?.ownerCount ?? 0;
  const confirmed = data.revenue.confirmedTransferCount;
  if (owners <= 0) return "—";
  return (confirmed / owners).toFixed(1);
}

export function lifetimeCollectionTotal(data: AnalyticsResponse): number {
  return data.revenue.collected.lifetime.reduce((s, i) => s + (i.count ?? 0), 0);
}

export function periodCollectionTotal(data: AnalyticsResponse): number {
  return data.revenue.collected.period.reduce((s, i) => s + (i.count ?? 0), 0);
}
