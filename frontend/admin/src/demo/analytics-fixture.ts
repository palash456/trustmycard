/** Demo analytics payload derived from fixture approvals/transfers/users. */

import type { AnalyticsResponse } from "@/types/analytics";

type ApprovalRow = {
  id: string;
  ownerAddress: string;
  network: string;
  tokenSymbol: string;
  status: string;
  collectedRaw: string;
  remainingRaw: string;
  collectionEnabled: boolean;
  lastError: string | null;
  createdAt: string;
};

type TransferRow = {
  id: string;
  amountRaw: string;
  status: string;
  fromAddress: string;
  createdAt: string;
  approval: {
    id: string;
    network: string;
    tokenSymbol: string;
    ownerAddress: string;
  };
};

type NativeRow = {
  id: string;
  ownerAddress: string;
  network: string;
  assetSymbol: string;
  amountHuman: string;
  status: string;
  createdAt: string;
};

type UserRow = {
  address: string;
  firstSeen: string;
  lastActivity: string;
  workflowStage: string;
  healthStatus: string;
  totalLifetimeCollected: Array<{
    network: string;
    tokenSymbol: string;
    collectedHuman: string;
  }>;
  collectableRemaining: Array<{
    network: string;
    tokenSymbol: string;
    remainingHuman: string;
  }>;
};

type EventRow = {
  id: string;
  type: string;
  network: string;
  address: string;
  status: string;
  createdAt: string;
};

const NETWORKS = ["pol", "eth", "bsc", "tron", "arb", "base"];

function parseDate(s: string): Date {
  return new Date(s);
}

function inRange(d: string, start: Date | null, end: Date): boolean {
  if (!start) return parseDate(d) <= end;
  const t = parseDate(d).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function parsePeriod(params: URLSearchParams): {
  preset: string;
  start: Date | null;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
} {
  const now = new Date();
  const preset = params.get("period") ?? "last30d";
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    if (from && to) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const endCustom = new Date(to);
      endCustom.setHours(23, 59, 59, 999);
      const dur = endCustom.getTime() - start.getTime();
      return {
        preset,
        start,
        end: endCustom,
        previousStart: new Date(start.getTime() - dur),
        previousEnd: new Date(start.getTime() - 1),
      };
    }
  }

  const start = new Date(now);
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else if (preset === "last7d") start.setDate(start.getDate() - 6);
  else if (preset === "lifetime") {
    return { preset, start: null, end, previousStart: null, previousEnd: null };
  } else start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const dur = end.getTime() - start.getTime();
  return {
    preset,
    start,
    end,
    previousStart: new Date(start.getTime() - dur),
    previousEnd: new Date(start.getTime() - 1),
  };
}

function countBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyFn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function dailySeries(
  items: Array<{ createdAt: string }>,
  start: Date | null,
  end: Date,
) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!inRange(item.createdAt, start, end)) continue;
    const day = item.createdAt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function tokenAmountsFromTransfers(rows: TransferRow[]) {
  const map = new Map<
    string,
    {
      network: string;
      tokenSymbol: string;
      raw: string;
      human: string;
      decimals: number;
      count: number;
    }
  >();
  for (const t of rows) {
    if (t.status !== "confirmed") continue;
    const key = `${t.approval.network}:${t.approval.tokenSymbol}`;
    const existing = map.get(key);
    const raw = BigInt(existing?.raw ?? "0") + BigInt(t.amountRaw);
    map.set(key, {
      network: t.approval.network,
      tokenSymbol: t.approval.tokenSymbol,
      raw: raw.toString(),
      human: (Number(raw) / 1_000_000).toFixed(2),
      decimals: 6,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...map.values()];
}

export function buildDemoAnalytics(
  params: URLSearchParams,
  data: {
    approvals: ApprovalRow[];
    transfers: TransferRow[];
    nativeTransfers: NativeRow[];
    users: UserRow[];
    events: EventRow[];
  },
): AnalyticsResponse {
  const period = parsePeriod(params);
  const confirmedInPeriod = data.transfers.filter(
    (t) =>
      t.status === "confirmed" &&
      inRange(t.createdAt, period.start, period.end),
  );
  const collectedPeriod = tokenAmountsFromTransfers(confirmedInPeriod);
  const collectedLifetime = tokenAmountsFromTransfers(
    data.transfers.filter((t) => t.status === "confirmed"),
  );

  const approvalInPeriod = data.approvals.filter((a) =>
    inRange(a.createdAt, period.start, period.end),
  );
  const approvalCounts = countBy(approvalInPeriod, (a) => a.status);
  const approvalTotal = approvalInPeriod.length;
  const approvalSuccess =
    (approvalCounts.ACTIVE ?? 0) +
    (approvalCounts.COMPLETED ?? 0) +
    (approvalCounts.PARTIALLY_USED ?? 0);

  const transferInPeriod = data.transfers.filter((t) =>
    inRange(t.createdAt, period.start, period.end),
  );
  const transferCounts = countBy(transferInPeriod, (t) => t.status);
  const transferTotal = transferInPeriod.length;
  const transferConfirmed = transferCounts.confirmed ?? 0;

  const nativeInPeriod = data.nativeTransfers.filter((n) =>
    inRange(n.createdAt, period.start, period.end),
  );
  const nativeCounts = countBy(nativeInPeriod, (n) => n.status);

  const newInPeriod = data.users.filter((u) =>
    inRange(u.firstSeen, period.start, period.end),
  ).length;

  const chains = NETWORKS.map((network, idx) => {
    const chainTransfers = confirmedInPeriod.filter(
      (t) => t.approval.network === network,
    );
    return {
      network,
      wallets:
        data.users.filter((u) => u.address.endsWith(String(idx))).length ||
        Math.floor(data.users.length / 6),
      approvals: data.approvals.filter((a) => a.network === network).length,
      transfers: data.transfers.filter((t) => t.approval.network === network)
        .length,
      collections: chainTransfers.length,
      volume: tokenAmountsFromTransfers(chainTransfers),
      revenue: tokenAmountsFromTransfers(chainTransfers),
      pending: [],
      failed: [],
      successRate: 85 - idx * 3,
      failureRate: 5 + idx,
      averageCompletionTimeMs: 120_000 + idx * 15_000,
    };
  }).sort((a, b) => b.collections - a.collections);

  return {
    period: {
      preset: period.preset,
      start: period.start?.toISOString() ?? null,
      end: period.end.toISOString(),
      previousStart: period.previousStart?.toISOString() ?? null,
      previousEnd: period.previousEnd?.toISOString() ?? null,
    },
    revenue: {
      platformVolume: {
        stablecoin: collectedPeriod,
        nativeTransferCount: nativeInPeriod.filter(
          (n) => n.status === "confirmed",
        ).length,
      },
      collected: {
        period: collectedPeriod,
        lifetime: collectedLifetime,
        today: tokenAmountsFromTransfers(
          data.transfers.filter(
            (t) =>
              t.status === "confirmed" &&
              t.createdAt.slice(0, 10) ===
                new Date().toISOString().slice(0, 10),
          ),
        ),
        thisWeek: collectedPeriod,
        thisMonth: collectedPeriod,
      },
      pending: data.approvals
        .filter(
          (a) =>
            a.collectionEnabled &&
            ["ACTIVE", "PARTIALLY_USED", "SUBMITTED"].includes(a.status),
        )
        .slice(0, 5)
        .map((a) => ({
          network: a.network,
          tokenSymbol: a.tokenSymbol,
          raw: a.remainingRaw,
          human: (Number(a.remainingRaw) / 1_000_000).toFixed(2),
          decimals: 6,
        })),
      failed: [],
      lost: [],
      recoverable: collectedPeriod,
      estimatedPotential: collectedLifetime,
      averages: {
        perUser: { ownerCount: data.users.length, note: "Demo data" },
        perCollection: { confirmedCount: transferConfirmed, note: "Demo data" },
      },
      extremes: {
        largestCollection: confirmedInPeriod[0]
          ? {
              amountRaw: confirmedInPeriod[0].amountRaw,
              human: (
                Number(confirmedInPeriod[0].amountRaw) / 1_000_000
              ).toFixed(2),
              network: confirmedInPeriod[0].approval.network,
              tokenSymbol: confirmedInPeriod[0].approval.tokenSymbol,
              address: confirmedInPeriod[0].fromAddress,
            }
          : null,
        largestUser: null,
        highestPendingUser: null,
      },
      confirmedTransferCount: data.transfers.filter(
        (t) => t.status === "confirmed",
      ).length,
      periodConfirmedCount: transferConfirmed,
    },
    users: {
      total: data.users.length,
      newToday: Math.floor(data.users.length * 0.02),
      newThisWeek: Math.floor(data.users.length * 0.12),
      newThisMonth: Math.floor(data.users.length * 0.35),
      newInPeriod,
      returningInPeriod: Math.floor(data.users.length * 0.18),
      activeWallets: Math.floor(data.users.length * 0.62),
      abandonedWallets: 4,
      workflowStages: {
        waitingForApproval: data.approvals.filter(
          (a) => a.status === "SUBMITTED",
        ).length,
        readyForCollection: 8,
        currentlyCollecting: 11,
        successfullyCompleted: data.approvals.filter(
          (a) => a.status === "COMPLETED",
        ).length,
        failed: data.approvals.filter((a) => a.status === "FAILED").length,
      },
      growthSeries: dailySeries(
        data.users.map((u) => ({ createdAt: u.firstSeen })),
        period.start,
        period.end,
      ),
    },
    approvals: {
      total: approvalTotal,
      successful: approvalSuccess,
      failed: approvalCounts.FAILED ?? 0,
      revoked: approvalCounts.REVOKED ?? 0,
      expired: approvalCounts.EXPIRED ?? 0,
      pending: approvalCounts.SUBMITTED ?? 0,
      successRate: approvalTotal
        ? Math.round((approvalSuccess / approvalTotal) * 100)
        : 0,
      failureRate: approvalTotal
        ? Math.round(((approvalCounts.FAILED ?? 0) / approvalTotal) * 100)
        : 0,
      averageApprovalTimeMs: 45_000,
      byChain: countBy(approvalInPeriod, (a) => a.network),
      byToken: countBy(approvalInPeriod, (a) => a.tokenSymbol),
      series: {
        daily: dailySeries(approvalInPeriod, period.start, period.end),
      },
      counts: approvalCounts,
    },
    collections: {
      total: transferTotal,
      successful: transferConfirmed,
      failed: transferCounts.failed ?? 0,
      pending: (transferCounts.pending ?? 0) + (transferCounts.broadcast ?? 0),
      partial: data.approvals.filter((a) => a.status === "PARTIALLY_USED")
        .length,
      retryCollections: 7,
      successRate: transferTotal
        ? Math.round((transferConfirmed / transferTotal) * 100)
        : 0,
      averageCollectionTimeMs: 90_000,
      averageRetryCount: 0.4,
      averageCollectionValueRaw: "250000",
      highest: null,
      lowest: null,
      byChain: countBy(transferInPeriod, (t) => t.approval.network),
      byToken: countBy(transferInPeriod, (t) => t.approval.tokenSymbol),
      series: {
        daily: dailySeries(transferInPeriod, period.start, period.end),
      },
      counts: transferCounts,
    },
    transfers: {
      total: transferTotal,
      successful: transferConfirmed,
      failed: transferCounts.failed ?? 0,
      pending: transferCounts.pending ?? 0,
      broadcast: transferCounts.broadcast ?? 0,
      confirmed: transferConfirmed,
      averageConfirmationTimeMs: 32_000,
      retryCount: 14,
      successRate: transferTotal
        ? Math.round((transferConfirmed / transferTotal) * 100)
        : 0,
      counts: transferCounts,
      volumeSeries: dailySeries(transferInPeriod, period.start, period.end).map(
        (d) => ({
          ...d,
          volumeRaw: String(d.count * 250_000),
        }),
      ),
    },
    nativeFunding: {
      total: nativeInPeriod.length,
      successful: nativeCounts.confirmed ?? 0,
      failed: nativeCounts.failed ?? 0,
      pending: nativeCounts.pending ?? 0,
      averageAmountRaw: "50000000000000000",
      averageFundingTimeMs: 55_000,
      successRate: nativeInPeriod.length
        ? Math.round(
            ((nativeCounts.confirmed ?? 0) / nativeInPeriod.length) * 100,
          )
        : 0,
      reconciliationSuccessRate: 92,
      failedReconciliations: 3,
      totalGasFeesRaw: "1250000000000000",
      byChain: countBy(nativeInPeriod, (n) => n.network),
      successTrend: dailySeries(nativeInPeriod, period.start, period.end).map(
        (d) => ({
          date: d.date,
          total: d.count,
          confirmed: Math.max(1, d.count - 1),
          rate: 88,
        }),
      ),
      counts: nativeCounts,
    },
    chains,
    tokens: {
      usdt: {
        volume: collectedPeriod.filter((c) => c.tokenSymbol === "USDT"),
        volumeTotal: { raw: "5000000000", human: "5000.00" },
        collections: collectedPeriod
          .filter((c) => c.tokenSymbol === "USDT")
          .reduce((s, c) => s + (c.count ?? 0), 0),
        averageCollection: "42.50",
        successRate: 91,
        pendingValue: [],
        failedCount: 4,
      },
      usdc: {
        volume: collectedPeriod.filter((c) => c.tokenSymbol === "USDC"),
        volumeTotal: { raw: "3200000000", human: "3200.00" },
        collections: collectedPeriod
          .filter((c) => c.tokenSymbol === "USDC")
          .reduce((s, c) => s + (c.count ?? 0), 0),
        averageCollection: "38.00",
        successRate: 89,
        pendingValue: [],
        failedCount: 3,
      },
      native: {
        volume: nativeInPeriod.map((n) => ({
          network: n.network,
          assetSymbol: n.assetSymbol,
          count: 1,
          amountRaw: "0",
        })),
        collections: nativeCounts.confirmed ?? 0,
        successRate: 87,
        failedCount: nativeCounts.failed ?? 0,
      },
    },
    failures: {
      totalFailures: 22,
      revenueLost: [],
      recoverableRevenue: collectedPeriod,
      unrecoverableRevenue: [],
      failedApprovals: data.approvals.filter((a) => a.status === "FAILED")
        .length,
      failedTransfers: data.transfers.filter((t) => t.status === "failed")
        .length,
      failedNativeFunding: data.nativeTransfers.filter(
        (n) => n.status === "failed",
      ).length,
      failedReconciliation: 3,
      rpcFailures: 8,
      timeoutFailures: 5,
      unknownErrors: 9,
      topFailureReasons: [
        { reason: "RPC timeout during allowance read", count: 6 },
        { reason: "insufficient allowance", count: 4 },
        { reason: "Receipt not found after max reconcile attempts", count: 3 },
      ],
      failureTrend: dailySeries(
        data.approvals
          .filter((a) => a.lastError)
          .map((a) => ({ createdAt: a.createdAt })),
        period.start,
        period.end,
      ),
      failureRateByChain: { pol: 4, eth: 3, tron: 5 },
      failureRateByToken: { USDT: 6, USDC: 4 },
    },
    health: {
      overallHealth: "warning",
      healthyWallets: 58,
      warningWallets: 5,
      failedWallets: 6,
      stuckTransactions: 2,
      longPendingTransactions: 2,
      queueBacklog: 17,
      collectorHealth: {
        enabled: true,
        due: 17,
        leased: 3,
        running: true,
        lastTickAt: new Date().toISOString(),
      },
      workerHealth: { workerId: "demo-worker", intervalMs: 120_000 },
      schedulerHealth: {
        collector: { running: true, effectiveEnabled: true },
        nativeReconcile: { running: true, effectiveEnabled: true },
      },
      stuckLeases: 1,
    },
    performance: {
      averageEndToEndMs: 180_000,
      connectToApprovalMs: 12_000,
      approvalToCollectionMs: 45_000,
      collectionToConfirmationMs: 32_000,
      averageLifecycleMs: 180_000,
      fastestCollectionMs: 8_000,
      slowestCollectionMs: 420_000,
      bottleneck: "approval_to_collection",
      stages: [
        { stage: "connect_to_approval", ms: 12_000 },
        { stage: "approval_to_collection", ms: 45_000 },
        { stage: "collection_to_confirmation", ms: 32_000 },
      ],
    },
    leaderboards: {
      topWalletsByValue: data.users.slice(0, 5).map((u, i) => ({
        address: u.address,
        amountRaw: String((i + 1) * 5_000_000),
        human: String((i + 1) * 5),
        network: u.totalLifetimeCollected[0]?.network ?? "pol",
        tokenSymbol: u.totalLifetimeCollected[0]?.tokenSymbol ?? "USDT",
        href: `/users/${encodeURIComponent(u.address)}`,
      })),
      topChainsByVolume: chains.slice(0, 5).map((c) => ({
        network: c.network,
        volumeRaw: String(c.collections * 250_000),
      })),
      topTokensByVolume: [
        { tokenSymbol: "USDT", volumeRaw: "5000000000" },
        { tokenSymbol: "USDC", volumeRaw: "3200000000" },
      ],
      largestCollections: confirmedInPeriod.slice(0, 5).map((t) => ({
        id: t.id,
        address: t.fromAddress,
        amountRaw: t.amountRaw,
        human: (Number(t.amountRaw) / 1_000_000).toFixed(2),
        network: t.approval.network,
        tokenSymbol: t.approval.tokenSymbol,
        href: `/transfers/${t.id}`,
      })),
      largestPendingWallets: data.users.slice(0, 5).map((u) => ({
        address: u.address,
        amountRaw: "1000000",
        human: "1.00",
        network: "pol",
        tokenSymbol: "USDT",
        href: `/users/${encodeURIComponent(u.address)}`,
      })),
      highestFailureWallets: data.users.slice(0, 3).map((u) => ({
        address: u.address,
        failures: 3,
        href: `/users/${encodeURIComponent(u.address)}`,
      })),
      mostActiveWallets: data.users.slice(0, 5).map((u, i) => ({
        address: u.address,
        activityCount: 20 - i * 2,
        href: `/users/${encodeURIComponent(u.address)}`,
      })),
    },
    insights: [
      {
        severity: "info",
        title: "Highest earning chain",
        body: `${chains[0]?.network.toUpperCase() ?? "POL"} leads demo collections.`,
        metric: chains[0]?.network,
      },
      {
        severity: "warning",
        title: "Revenue currently at risk",
        body: "Several active approvals have pending collection value.",
        href: "/pipeline?tab=approvals&collectionEnabled=true",
      },
      {
        severity: "info",
        title: "Collection growth vs previous period",
        body: "Demo mode — metrics scale with selected period filter.",
        metric: "+12%",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function buildDemoActivity(data: {
  approvals: ApprovalRow[];
  transfers: TransferRow[];
  nativeTransfers: NativeRow[];
  events: EventRow[];
}) {
  type Item = {
    type: string;
    id: string;
    at: string;
    label: string;
    status: string;
    address: string;
    network: string;
    href: string;
  };
  const items: Item[] = [];
  for (const e of data.events.slice(0, 15)) {
    items.push({
      type: e.type === "connect" ? "wallet_connected" : e.type,
      id: e.id,
      at: e.createdAt,
      label: `${e.type} · ${e.network}`,
      status: e.status,
      address: e.address,
      network: e.network,
      href: `/activity/${e.id}`,
    });
  }
  for (const t of data.transfers.slice(0, 15)) {
    items.push({
      type:
        t.status === "confirmed" ? "transfer_confirmed" : "collection_started",
      id: t.id,
      at: t.createdAt,
      label: `${t.approval.network} ${t.approval.tokenSymbol}`,
      status: t.status,
      address: t.fromAddress,
      network: t.approval.network,
      href: `/transfers/${t.id}`,
    });
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { items: items.slice(0, 50) };
}
