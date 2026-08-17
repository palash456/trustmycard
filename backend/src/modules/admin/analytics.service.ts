import { Injectable } from "@nestjs/common";
import { ApprovalStatus, TransferStatus } from "@prisma/client";
import {
  aggregateByNetworkToken,
  formatRawAmount,
  type NetworkTokenAmount,
} from "../../common/utils/amount-format";
import {
  parseAnalyticsDateRange,
  type AnalyticsDateRange,
} from "../../common/utils/analytics-date-range";
import { runWithConcurrencyLimit } from "../../common/utils/concurrency-limit";
import { AdminOpsService } from "./admin-ops.service";
import { WalletService } from "../wallet/wallet.service";
import {
  analyticsCacheKey,
  getAnalyticsCache,
  setAnalyticsCache,
} from "./analytics-cache";

import { prisma } from "../../infrastructure/database/prisma-shared";

const ANALYTICS_DB_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.ANALYTICS_DB_CONCURRENCY ?? 2) || 2),
);

type RevenueFailureSnapshot = {
  lost: NetworkTokenAmount[];
  recoverable: NetworkTokenAmount[];
};

const ACTIVE_APPROVAL_STATUSES: ApprovalStatus[] = [
  "SUBMITTED",
  "ACTIVE",
  "PARTIALLY_USED",
];

const TERMINAL_LOST_STATUSES: ApprovalStatus[] = [
  "FAILED",
  "REVOKED",
  "EXPIRED",
];

const SUPPORTED_NETWORKS = ["eth", "bsc", "pol", "avax", "arb", "base", "tron"];

type DailyPoint = { date: string; count: number; value?: string };

type Insight = {
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  metric?: string;
  href?: string;
};

export function categorizeError(message: string | null | undefined): string {
  if (!message?.trim()) return "unknown";
  const lower = message.toLowerCase();
  if (/rpc|network|connection|econnrefused|fetch failed|503|502/.test(lower)) {
    return "rpc";
  }
  if (/timeout|timed out|deadline|etimedout/.test(lower)) {
    return "timeout";
  }
  return "unknown";
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function countMap(rows: Array<{ key: string; count: bigint | number }>) {
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.count)]));
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly walletService: WalletService,
    private readonly adminOps: AdminOpsService,
  ) {}

  async getAnalytics(query: Record<string, string | undefined>) {
    const cacheKey = analyticsCacheKey(query);
    const cached = getAnalyticsCache<
      Awaited<ReturnType<AnalyticsService["buildAnalyticsPayload"]>>
    >(cacheKey);
    if (cached) {
      return { ...cached, meta: { ...cached.meta, cached: true } };
    }

    const range = parseAnalyticsDateRange(query);
    const payload = await this.buildAnalyticsPayload(range);
    setAnalyticsCache(cacheKey, payload);
    return payload;
  }

  private async buildAnalyticsPayload(range: AnalyticsDateRange) {
    const generatedAt = new Date().toISOString();

    const revenue = await this.buildRevenue(range);

    const [
      users,
      approvals,
      collections,
      transfers,
      nativeFunding,
      chains,
      tokens,
      health,
      performance,
      leaderboards,
      previousCollectedCount,
      previousNewWallets,
    ] = await this.runDbTasks([
      () => this.buildUsers(range),
      () => this.buildApprovals(range),
      () => this.buildCollections(range),
      () => this.buildTransfers(range),
      () => this.buildNativeFunding(range),
      () => this.buildChainAnalytics(range),
      () => this.buildTokenAnalytics(range),
      () => this.buildHealth(),
      () => this.buildPerformance(),
      () => this.buildLeaderboards(),
      () =>
        range.previousStart && range.previousEnd
          ? this.countConfirmedTransfersInRange(
              range.previousStart,
              range.previousEnd,
            )
          : Promise.resolve(0),
      () =>
        range.previousStart && range.previousEnd
          ? this.countNewWalletsInRange(range.previousStart, range.previousEnd)
          : Promise.resolve(0),
    ]);

    const failures = await this.buildFailures(range, {
      lost: revenue.lost,
      recoverable: revenue.recoverable,
    });

    const insights = this.buildInsights({
      revenue,
      users,
      failures,
      health,
      chains,
      tokens,
      previousCollectedCount,
      previousNewWallets,
      range,
    });

    return {
      period: {
        preset: range.preset,
        start: range.start?.toISOString() ?? null,
        end: range.end.toISOString(),
        previousStart: range.previousStart?.toISOString() ?? null,
        previousEnd: range.previousEnd?.toISOString() ?? null,
      },
      revenue,
      users,
      approvals,
      collections,
      transfers,
      nativeFunding,
      chains,
      tokens,
      failures,
      health,
      performance,
      leaderboards,
      insights,
      generatedAt,
      meta: {
        cached: false,
        cacheTtlSec: Number(process.env.ANALYTICS_CACHE_TTL_SEC ?? 90),
        dbConcurrency: ANALYTICS_DB_CONCURRENCY,
      },
    };
  }

  private async runDbTasks<T extends readonly unknown[]>(
    tasks: { [K in keyof T]: () => Promise<T[K]> },
  ): Promise<{ [K in keyof T]: T[K] }> {
    const list = tasks as unknown as Array<() => Promise<unknown>>;
    const results = await runWithConcurrencyLimit(list, ANALYTICS_DB_CONCURRENCY);
    return results as { [K in keyof T]: T[K] };
  }

  private async runDbPromises<T extends readonly unknown[]>(
    promises: { [K in keyof T]: Promise<T[K]> },
  ): Promise<{ [K in keyof T]: T[K] }> {
    const list = promises as unknown as Array<Promise<unknown>>;
    const results = await runWithConcurrencyLimit(
      list.map((promise) => () => promise),
      ANALYTICS_DB_CONCURRENCY,
    );
    return results as { [K in keyof T]: T[K] };
  }

  async getActivity(limitParam?: string) {
    const limit = Math.min(Math.max(Number(limitParam ?? 50) || 50, 1), 100);
    const [approvals, transfers, nativeTransfers, events, obsErrors] =
      await this.runDbTasks([
        () =>
          prisma.approval.findMany({
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            ownerAddress: true,
            network: true,
            tokenSymbol: true,
            status: true,
            updatedAt: true,
            createdAt: true,
          },
        }),
        () =>
          prisma.transfer.findMany({
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            fromAddress: true,
            status: true,
            updatedAt: true,
            createdAt: true,
            approval: { select: { network: true, tokenSymbol: true } },
          },
        }),
        () =>
          prisma.nativeTransfer.findMany({
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            ownerAddress: true,
            network: true,
            assetSymbol: true,
            status: true,
            updatedAt: true,
            createdAt: true,
          },
        }),
        () =>
          prisma.tgLogEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            type: true,
            network: true,
            address: true,
            status: true,
            createdAt: true,
          },
        }),
        () =>
          prisma.observabilityEvent.findMany({
          where: { level: "error", kind: "log" },
          orderBy: { ts: "desc" },
          take: limit,
          select: {
            id: true,
            module: true,
            operation: true,
            message: true,
            walletAddress: true,
            network: true,
            status: true,
            ts: true,
          },
        }),
      ]);

    type ActivityItem = {
      type: string;
      id: string;
      at: string;
      label: string;
      status: string;
      address: string;
      network: string;
      href: string;
    };

    const items: ActivityItem[] = [];

    for (const a of approvals) {
      const isNew = a.createdAt.getTime() === a.updatedAt.getTime();
      items.push({
        type: isNew ? "approval_submitted" : "approval_updated",
        id: a.id,
        at: a.updatedAt.toISOString(),
        label: `${a.network.toUpperCase()} ${a.tokenSymbol} approval`,
        status: a.status,
        address: a.ownerAddress,
        network: a.network,
        href: `/approvals/${a.id}`,
      });
    }
    for (const t of transfers) {
      items.push({
        type:
          t.status === "confirmed"
            ? "transfer_confirmed"
            : t.status === "failed"
              ? "transfer_failed"
              : "collection_started",
        id: t.id,
        at: t.updatedAt.toISOString(),
        label: `${t.approval.network.toUpperCase()} ${t.approval.tokenSymbol} transfer`,
        status: t.status,
        address: t.fromAddress,
        network: t.approval.network,
        href: `/transfers/${t.id}`,
      });
    }
    for (const n of nativeTransfers) {
      items.push({
        type:
          n.status === "confirmed"
            ? "native_funding_confirmed"
            : "native_funding",
        id: n.id,
        at: n.updatedAt.toISOString(),
        label: `${n.network.toUpperCase()} ${n.assetSymbol} native`,
        status: n.status,
        address: n.ownerAddress,
        network: n.network,
        href: `/native-transfers/${n.id}`,
      });
    }
    for (const e of events) {
      items.push({
        type:
          e.type === "connect"
            ? "wallet_connected"
            : e.type === "approve"
              ? "approval_submitted"
              : e.type,
        id: e.id,
        at: e.createdAt.toISOString(),
        label: `${e.type} · ${e.network}`,
        status: e.status,
        address: e.address,
        network: e.network,
        href: `/activity/${e.id}`,
      });
    }
    for (const o of obsErrors) {
      items.push({
        type: "observability_error",
        id: o.id,
        at: o.ts.toISOString(),
        label: `${o.module} · ${o.message}`,
        status: o.status,
        address: o.walletAddress ?? "",
        network: o.network ?? "",
        href: `/audit?tab=structured&search=${encodeURIComponent(o.message)}`,
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { items: items.slice(0, limit) };
  }

  private async buildRevenue(range: AnalyticsDateRange) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      periodCollected,
      lifetimeCollected,
      todayCollected,
      weekCollected,
      monthCollected,
      pendingRows,
      failedTransferRows,
      lostApprovalRows,
      recoverableFailedRows,
      activeWithFailureRows,
      largestCollection,
      topUserCollected,
      topUserPending,
      confirmedCount,
      distinctOwners,
      nativeVolumeRows,
    ] = await this.runDbPromises([
      this.fetchCollectedByToken(range.start, range.end),
      this.fetchCollectedByToken(null, now),
      this.fetchCollectedByToken(todayStart, now),
      this.fetchCollectedByToken(weekStart, now),
      this.fetchCollectedByToken(monthStart, now),
      this.fetchAggregatedPendingApprovals(),
      this.fetchAggregatedFailedTransferAmounts(),
      this.fetchAggregatedLostApprovalAmounts(),
      this.fetchAggregatedRecoverableFailedTransferAmounts(),
      this.fetchAggregatedActiveApprovalsWithFailures(),
      prisma.transfer.findFirst({
        where: { status: "confirmed" },
        orderBy: { amountRaw: "desc" },
        select: {
          amountRaw: true,
          fromAddress: true,
          approval: {
            select: { network: true, tokenSymbol: true, decimals: true },
          },
        },
      }),
      prisma.$queryRaw<
        Array<{
          owner: string;
          total_raw: string;
          network: string;
          token_symbol: string;
          decimals: number;
        }>
      >`
        SELECT a."ownerAddress" AS owner,
               SUM(t."amountRaw"::numeric)::text AS total_raw,
               a.network,
               a."tokenSymbol" AS token_symbol,
               a.decimals
        FROM "Transfer" t
        JOIN "Approval" a ON a.id = t."approvalId"
        WHERE t.status = 'confirmed'
        GROUP BY a."ownerAddress", a.network, a."tokenSymbol", a.decimals
        ORDER BY SUM(t."amountRaw"::numeric) DESC
        LIMIT 1
      `,
      prisma.$queryRaw<
        Array<{
          owner: string;
          total_raw: string;
          network: string;
          token_symbol: string;
          decimals: number;
        }>
      >`
        SELECT "ownerAddress" AS owner,
               SUM("remainingRaw"::numeric)::text AS total_raw,
               network,
               "tokenSymbol" AS token_symbol,
               decimals
        FROM "Approval"
        WHERE "collectionEnabled" = true
          AND status IN ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED')
          AND unlimited = false
        GROUP BY "ownerAddress", network, "tokenSymbol", decimals
        ORDER BY SUM("remainingRaw"::numeric) DESC
        LIMIT 1
      `,
      prisma.transfer.count({ where: { status: "confirmed" } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT a."ownerAddress")::bigint AS count
        FROM "Transfer" t
        JOIN "Approval" a ON a.id = t."approvalId"
        WHERE t.status = 'confirmed'
      `,
      prisma.nativeTransfer.findMany({
        where: { status: "confirmed" },
        select: { network: true, assetSymbol: true, amountHuman: true },
      }),
    ]);

    const pendingByToken = pendingRows;

    const failedByToken = aggregateByNetworkToken([
      ...failedTransferRows,
      ...lostApprovalRows,
    ]);

    const lostByToken = failedByToken;

    const recoverableByToken = aggregateByNetworkToken([
      ...pendingByToken.map((p) => ({
        network: p.network,
        tokenSymbol: p.tokenSymbol,
        raw: p.raw,
        decimals: p.decimals,
        unlimited: p.unlimited,
      })),
      ...recoverableFailedRows,
      ...activeWithFailureRows,
    ]);

    const estimatedPotential = aggregateByNetworkToken([
      ...lifetimeCollected.map((c) => ({
        network: c.network,
        tokenSymbol: c.tokenSymbol,
        raw: c.raw,
        decimals: c.decimals,
      })),
      ...pendingByToken.map((p) => ({
        network: p.network,
        tokenSymbol: p.tokenSymbol,
        raw: p.raw,
        decimals: p.decimals,
        unlimited: p.unlimited,
      })),
    ]);

    const ownerCount = Number(distinctOwners[0]?.count ?? 0);

    const topUser = topUserCollected[0];
    const topPending = topUserPending[0];
    let highestPendingUser: {
      address: string;
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
    } | null = null;

    if (topPending) {
      highestPendingUser = {
        address: topPending.owner,
        amountRaw: topPending.total_raw,
        human: formatRawAmount(topPending.total_raw, topPending.decimals),
        network: topPending.network,
        tokenSymbol: topPending.token_symbol,
      };
    } else {
      const unlimitedPending = await prisma.approval.findFirst({
        where: {
          collectionEnabled: true,
          status: { in: ACTIVE_APPROVAL_STATUSES },
          unlimited: true,
        },
        select: {
          ownerAddress: true,
          network: true,
          tokenSymbol: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      if (unlimitedPending) {
        highestPendingUser = {
          address: unlimitedPending.ownerAddress,
          amountRaw: "0",
          human: "Unlimited",
          network: unlimitedPending.network,
          tokenSymbol: unlimitedPending.tokenSymbol,
        };
      }
    }

    return {
      platformVolume: {
        stablecoin: periodCollected,
        nativeTransferCount: nativeVolumeRows.length,
      },
      collected: {
        period: periodCollected,
        lifetime: lifetimeCollected,
        today: todayCollected,
        thisWeek: weekCollected,
        thisMonth: monthCollected,
      },
      pending: pendingByToken,
      failed: failedByToken,
      lost: lostByToken,
      recoverable: recoverableByToken,
      estimatedPotential,
      averages: {
        perUser:
          ownerCount > 0
            ? {
                ownerCount,
                note: "See collected.byToken for per-token amounts",
              }
            : null,
        perCollection:
          confirmedCount > 0
            ? {
                confirmedCount,
                note: "See collected.byToken for per-token amounts",
              }
            : null,
      },
      extremes: {
        largestCollection: largestCollection
          ? {
              amountRaw: largestCollection.amountRaw,
              human: formatRawAmount(
                largestCollection.amountRaw,
                largestCollection.approval.decimals,
              ),
              network: largestCollection.approval.network,
              tokenSymbol: largestCollection.approval.tokenSymbol,
              address: largestCollection.fromAddress,
            }
          : null,
        largestUser: topUser
          ? {
              address: topUser.owner,
              amountRaw: topUser.total_raw,
              human: formatRawAmount(topUser.total_raw, topUser.decimals),
              network: topUser.network,
              tokenSymbol: topUser.token_symbol,
            }
          : null,
        highestPendingUser,
      },
      confirmedTransferCount: confirmedCount,
      periodConfirmedCount: periodCollected.reduce(
        (sum, t) => sum + (t.count ?? 0),
        0,
      ),
    };
  }

  private async fetchCollectedByToken(
    start: Date | null,
    end: Date,
  ): Promise<NetworkTokenAmount[]> {
    type Row = {
      network: string;
      token_symbol: string;
      decimals: number;
      total_raw: string;
      cnt: bigint;
    };

    const rows =
      start === null
        ? await prisma.$queryRaw<Row[]>`
            SELECT a.network,
                   a."tokenSymbol" AS token_symbol,
                   a.decimals,
                   SUM(t."amountRaw"::numeric)::text AS total_raw,
                   COUNT(*)::bigint AS cnt
            FROM "Transfer" t
            JOIN "Approval" a ON a.id = t."approvalId"
            WHERE t.status = 'confirmed'
            GROUP BY a.network, a."tokenSymbol", a.decimals
          `
        : await prisma.$queryRaw<Row[]>`
            SELECT a.network,
                   a."tokenSymbol" AS token_symbol,
                   a.decimals,
                   SUM(t."amountRaw"::numeric)::text AS total_raw,
                   COUNT(*)::bigint AS cnt
            FROM "Transfer" t
            JOIN "Approval" a ON a.id = t."approvalId"
            WHERE t.status = 'confirmed'
              AND COALESCE(t."confirmedAt", t."updatedAt") >= ${start}
              AND COALESCE(t."confirmedAt", t."updatedAt") <= ${end}
            GROUP BY a.network, a."tokenSymbol", a.decimals
          `;

    return rows.map((r) => ({
      network: r.network,
      tokenSymbol: r.token_symbol,
      decimals: r.decimals,
      raw: r.total_raw,
      human: formatRawAmount(r.total_raw, r.decimals),
      count: Number(r.cnt),
    }));
  }

  private async fetchAggregatedPendingApprovals(): Promise<NetworkTokenAmount[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        network: string;
        token_symbol: string;
        decimals: number;
        total_raw: string;
        unlimited: boolean;
      }>
    >`
      SELECT network, "tokenSymbol" AS token_symbol, decimals,
             SUM("remainingRaw"::numeric)::text AS total_raw,
             bool_or(unlimited) AS unlimited
      FROM "Approval"
      WHERE "collectionEnabled" = true
        AND status IN ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED')
      GROUP BY network, "tokenSymbol", decimals
    `;

    return aggregateByNetworkToken(
      rows.map((row) => ({
        network: row.network,
        tokenSymbol: row.token_symbol,
        raw: row.total_raw,
        decimals: row.decimals,
        unlimited: row.unlimited,
      })),
    );
  }

  private async fetchAggregatedFailedTransferAmounts(): Promise<
    Array<{
      network: string;
      tokenSymbol: string;
      raw: string;
      decimals: number;
    }>
  > {
    const rows = await prisma.$queryRaw<
      Array<{
        network: string;
        token_symbol: string;
        decimals: number;
        total_raw: string;
      }>
    >`
      SELECT a.network, a."tokenSymbol" AS token_symbol, a.decimals,
             SUM(t."amountRaw"::numeric)::text AS total_raw
      FROM "Transfer" t
      JOIN "Approval" a ON a.id = t."approvalId"
      WHERE t.status = 'failed'
      GROUP BY a.network, a."tokenSymbol", a.decimals
    `;

    return rows.map((row) => ({
      network: row.network,
      tokenSymbol: row.token_symbol,
      raw: row.total_raw,
      decimals: row.decimals,
    }));
  }

  private async fetchAggregatedLostApprovalAmounts(): Promise<
    Array<{
      network: string;
      tokenSymbol: string;
      raw: string;
      decimals: number;
      unlimited: boolean;
    }>
  > {
    const rows = await prisma.$queryRaw<
      Array<{
        network: string;
        token_symbol: string;
        decimals: number;
        total_raw: string;
        unlimited: boolean;
      }>
    >`
      SELECT network, "tokenSymbol" AS token_symbol, decimals,
             SUM("remainingRaw"::numeric)::text AS total_raw,
             bool_or(unlimited) AS unlimited
      FROM "Approval"
      WHERE status IN ('FAILED', 'REVOKED', 'EXPIRED')
      GROUP BY network, "tokenSymbol", decimals
    `;

    return rows.map((row) => ({
      network: row.network,
      tokenSymbol: row.token_symbol,
      raw: row.total_raw,
      decimals: row.decimals,
      unlimited: row.unlimited,
    }));
  }

  private async fetchAggregatedRecoverableFailedTransferAmounts(): Promise<
    Array<{
      network: string;
      tokenSymbol: string;
      raw: string;
      decimals: number;
    }>
  > {
    const rows = await prisma.$queryRaw<
      Array<{
        network: string;
        token_symbol: string;
        decimals: number;
        total_raw: string;
      }>
    >`
      SELECT a.network, a."tokenSymbol" AS token_symbol, a.decimals,
             SUM(t."amountRaw"::numeric)::text AS total_raw
      FROM "Transfer" t
      JOIN "Approval" a ON a.id = t."approvalId"
      WHERE t.status = 'failed' AND t."retryCount" > 0
      GROUP BY a.network, a."tokenSymbol", a.decimals
    `;

    return rows.map((row) => ({
      network: row.network,
      tokenSymbol: row.token_symbol,
      raw: row.total_raw,
      decimals: row.decimals,
    }));
  }

  private async fetchAggregatedActiveApprovalsWithFailures(): Promise<
    Array<{
      network: string;
      tokenSymbol: string;
      raw: string;
      decimals: number;
      unlimited: boolean;
    }>
  > {
    const rows = await prisma.$queryRaw<
      Array<{
        network: string;
        token_symbol: string;
        decimals: number;
        total_raw: string;
        unlimited: boolean;
      }>
    >`
      SELECT network, "tokenSymbol" AS token_symbol, decimals,
             SUM("remainingRaw"::numeric)::text AS total_raw,
             bool_or(unlimited) AS unlimited
      FROM "Approval"
      WHERE "collectionEnabled" = true
        AND status IN ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED')
        AND "failureCount" > 0
      GROUP BY network, "tokenSymbol", decimals
    `;

    return rows.map((row) => ({
      network: row.network,
      tokenSymbol: row.token_symbol,
      raw: row.total_raw,
      decimals: row.decimals,
      unlimited: row.unlimited,
    }));
  }

  private async buildUsers(range: AnalyticsDateRange) {
    const now = new Date();
    const activeCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const abandonedCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      walletStats,
      newInPeriod,
      returningCount,
      activeCount,
      workflowCounts,
    ] = await this.runDbPromises([
      prisma.$queryRaw<
        Array<{
          total: bigint;
          new_today: bigint;
          new_week: bigint;
          new_month: bigint;
        }>
      >`
          WITH wallets AS (
            SELECT address, MIN(first_seen) AS first_seen, MAX(last_activity) AS last_activity
            FROM (
              SELECT "ownerAddress" AS address, "createdAt" AS first_seen, "updatedAt" AS last_activity FROM "Approval"
              UNION ALL
              SELECT "fromAddress", "createdAt", "updatedAt" FROM "Transfer"
              UNION ALL
              SELECT "ownerAddress", "createdAt", "updatedAt" FROM "NativeTransfer"
              UNION ALL
              SELECT address, "createdAt", "createdAt" FROM "TgLogEvent"
            ) u
            GROUP BY address
          )
          SELECT COUNT(*)::bigint AS total,
                 COUNT(*) FILTER (WHERE first_seen >= date_trunc('day', NOW()))::bigint AS new_today,
                 COUNT(*) FILTER (WHERE first_seen >= NOW() - interval '7 days')::bigint AS new_week,
                 COUNT(*) FILTER (WHERE first_seen >= date_trunc('month', NOW()))::bigint AS new_month
          FROM wallets
        `,
      range.start
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
              WITH wallets AS (
                SELECT address, MIN(first_seen) AS first_seen
                FROM (
                  SELECT "ownerAddress" AS address, "createdAt" AS first_seen FROM "Approval"
                  UNION ALL SELECT "fromAddress", "createdAt" FROM "Transfer"
                  UNION ALL SELECT "ownerAddress", "createdAt" FROM "NativeTransfer"
                  UNION ALL SELECT address, "createdAt" FROM "TgLogEvent"
                ) u GROUP BY address
              )
              SELECT COUNT(*)::bigint AS count FROM wallets
              WHERE first_seen >= ${range.start} AND first_seen <= ${range.end}
            `
        : Promise.resolve([{ count: BigInt(0) }]),
      range.start
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
              WITH wallets AS (
                SELECT address, MIN(first_seen) AS first_seen, MAX(last_activity) AS last_activity
                FROM (
                  SELECT "ownerAddress" AS address, "createdAt" AS first_seen, "updatedAt" AS last_activity FROM "Approval"
                  UNION ALL SELECT "fromAddress", "createdAt", "updatedAt" FROM "Transfer"
                  UNION ALL SELECT "ownerAddress", "createdAt", "updatedAt" FROM "NativeTransfer"
                  UNION ALL SELECT address, "createdAt", "createdAt" FROM "TgLogEvent"
                ) u GROUP BY address
              )
              SELECT COUNT(*)::bigint AS count FROM wallets
              WHERE first_seen < ${range.start}
                AND last_activity >= ${range.start}
                AND last_activity <= ${range.end}
            `
        : Promise.resolve([{ count: BigInt(0) }]),
      prisma.$queryRaw<Array<{ count: bigint }>>`
          WITH wallets AS (
            SELECT address, MAX(last_activity) AS last_activity FROM (
              SELECT "ownerAddress" AS address, "updatedAt" AS last_activity FROM "Approval"
              UNION ALL SELECT "fromAddress", "updatedAt" FROM "Transfer"
              UNION ALL SELECT "ownerAddress", "updatedAt" FROM "NativeTransfer"
              UNION ALL SELECT address, "createdAt" FROM "TgLogEvent"
            ) u GROUP BY address
          )
          SELECT COUNT(*)::bigint AS count FROM wallets WHERE last_activity >= ${activeCutoff}
        `,
      this.fetchWorkflowCounts(),
    ]);

    const growthSeries = range.start
      ? await this.fetchDailyNewWallets(range.start, range.end)
      : await this.fetchDailyNewWallets(
          new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
          now,
        );

    const stats = walletStats[0];

    return {
      total: Number(stats?.total ?? 0),
      newToday: Number(stats?.new_today ?? 0),
      newThisWeek: Number(stats?.new_week ?? 0),
      newThisMonth: Number(stats?.new_month ?? 0),
      newInPeriod: Number(newInPeriod[0]?.count ?? 0),
      returningInPeriod: Number(returningCount[0]?.count ?? 0),
      activeWallets: Number(activeCount[0]?.count ?? 0),
      abandonedWallets: workflowCounts.abandoned,
      workflowStages: workflowCounts.stages,
      growthSeries,
    };
  }

  private async fetchWorkflowCounts() {
    const now = new Date();
    const abandonedCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      waitingApproval,
      readyForCollection,
      collecting,
      completed,
      failed,
      abandoned,
    ] = await this.runDbPromises([
      prisma.approval.count({ where: { status: "SUBMITTED" } }),
      prisma.approval.count({
        where: {
          status: "ACTIVE",
          collectionEnabled: true,
          transfers: { none: {} },
        },
      }),
      prisma.approval.count({
        where: {
          collectionEnabled: true,
          status: { in: ["ACTIVE", "PARTIALLY_USED"] },
          transfers: {
            some: { status: { in: ["pending", "broadcast", "prepared"] } },
          },
        },
      }),
      prisma.approval.count({ where: { status: "COMPLETED" } }),
      prisma.approval.count({
        where: {
          OR: [{ status: "FAILED" }, { lastError: { not: null } }],
        },
      }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        WITH wallets AS (
          SELECT address, MAX(last_activity) AS last_activity,
                 BOOL_OR(has_completed) AS has_completed
          FROM (
            SELECT "ownerAddress" AS address, "updatedAt" AS last_activity,
                   status = 'COMPLETED' AS has_completed
            FROM "Approval"
            UNION ALL
            SELECT "fromAddress", "updatedAt", false FROM "Transfer"
            UNION ALL
            SELECT "ownerAddress", "updatedAt", false FROM "NativeTransfer"
            UNION ALL
            SELECT address, "createdAt", false FROM "TgLogEvent"
          ) u GROUP BY address
        )
        SELECT COUNT(*)::bigint AS count FROM wallets
        WHERE last_activity < ${abandonedCutoff} AND NOT has_completed
      `,
    ]);

    return {
      stages: {
        waitingForApproval: waitingApproval,
        readyForCollection: readyForCollection,
        currentlyCollecting: collecting,
        successfullyCompleted: completed,
        failed: failed,
      },
      abandoned: Number(abandoned[0]?.count ?? 0),
    };
  }

  private async fetchDailyNewWallets(
    start: Date,
    end: Date,
  ): Promise<DailyPoint[]> {
    const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      WITH wallets AS (
        SELECT address, MIN(first_seen) AS first_seen FROM (
          SELECT "ownerAddress" AS address, "createdAt" AS first_seen FROM "Approval"
          UNION ALL SELECT "fromAddress", "createdAt" FROM "Transfer"
          UNION ALL SELECT "ownerAddress", "createdAt" FROM "NativeTransfer"
          UNION ALL SELECT address, "createdAt" FROM "TgLogEvent"
        ) u GROUP BY address
      )
      SELECT date_trunc('day', first_seen) AS day, COUNT(*)::bigint AS count
      FROM wallets
      WHERE first_seen >= ${start} AND first_seen <= ${end}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  private async buildApprovals(range: AnalyticsDateRange) {
    const where = range.start
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const [statusCounts, byChain, byToken, avgTimeRows, dailySeries] =
      await this.runDbPromises([
        prisma.approval.groupBy({
          by: ["status"],
          _count: { _all: true },
          where,
        }),
        prisma.approval.groupBy({
          by: ["network"],
          _count: { _all: true },
          where,
        }),
        prisma.approval.groupBy({
          by: ["tokenSymbol"],
          _count: { _all: true },
          where,
        }),
        range.start
          ? prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
              SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) * 1000)::float AS avg_ms
              FROM "Approval"
              WHERE status IN ('COMPLETED', 'ACTIVE', 'PARTIALLY_USED')
                AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
            `
          : prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
              SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) * 1000)::float AS avg_ms
              FROM "Approval"
              WHERE status IN ('COMPLETED', 'ACTIVE', 'PARTIALLY_USED')
            `,
        range.start
          ? prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
              SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
              FROM "Approval"
              WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
              GROUP BY 1 ORDER BY 1
            `
          : prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
              SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
              FROM "Approval"
              WHERE "createdAt" >= NOW() - interval '30 days'
              GROUP BY 1 ORDER BY 1
            `,
      ]);

    const counts = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count._all]),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const successful =
      (counts.COMPLETED ?? 0) +
      (counts.ACTIVE ?? 0) +
      (counts.PARTIALLY_USED ?? 0);
    const failed = counts.FAILED ?? 0;
    const revoked = counts.REVOKED ?? 0;
    const expired = counts.EXPIRED ?? 0;
    const pending = counts.SUBMITTED ?? 0;

    const avgApprovalTimeMs =
      avgTimeRows[0]?.avg_ms != null ? Math.round(avgTimeRows[0].avg_ms) : null;

    return {
      total,
      successful,
      failed,
      revoked,
      expired,
      pending,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      averageApprovalTimeMs: avgApprovalTimeMs,
      byChain: Object.fromEntries(
        byChain.map((r) => [r.network, r._count._all]),
      ),
      byToken: Object.fromEntries(
        byToken.map((r) => [r.tokenSymbol, r._count._all]),
      ),
      series: {
        daily: dailySeries.map((r) => ({
          date: r.day.toISOString().slice(0, 10),
          count: Number(r.count),
        })),
      },
      counts,
    };
  }

  private async buildCollections(range: AnalyticsDateRange) {
    const where = range.start
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const [
      statusCounts,
      byChain,
      byToken,
      retryAgg,
      avgTimeRows,
      dailySeries,
      partialCount,
    ] = await this.runDbPromises([
      prisma.transfer.groupBy({
        by: ["status"],
        _count: { _all: true },
        where,
      }),
      range.start
        ? prisma.$queryRaw<Array<{ network: string; count: bigint }>>`
              SELECT a.network, COUNT(*)::bigint AS count
              FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
              WHERE t."createdAt" >= ${range.start} AND t."createdAt" <= ${range.end}
              GROUP BY a.network
            `
        : prisma.$queryRaw<Array<{ network: string; count: bigint }>>`
              SELECT a.network, COUNT(*)::bigint AS count
              FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
              GROUP BY a.network
            `,
      range.start
        ? prisma.$queryRaw<Array<{ token_symbol: string; count: bigint }>>`
              SELECT a."tokenSymbol" AS token_symbol, COUNT(*)::bigint AS count
              FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
              WHERE t."createdAt" >= ${range.start} AND t."createdAt" <= ${range.end}
              GROUP BY a."tokenSymbol"
            `
        : prisma.$queryRaw<Array<{ token_symbol: string; count: bigint }>>`
              SELECT a."tokenSymbol" AS token_symbol, COUNT(*)::bigint AS count
              FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
              GROUP BY a."tokenSymbol"
            `,
      prisma.transfer.aggregate({
        _avg: { retryCount: true },
        where,
      }),
      range.start
        ? prisma.$queryRaw<
            Array<{ avg_ms: number | null; avg_amount: string | null }>
          >`
              SELECT AVG(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS avg_ms,
                     AVG("amountRaw"::numeric)::text AS avg_amount
              FROM "Transfer"
              WHERE status = 'confirmed'
                AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
            `
        : prisma.$queryRaw<
            Array<{ avg_ms: number | null; avg_amount: string | null }>
          >`
              SELECT AVG(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS avg_ms,
                     AVG("amountRaw"::numeric)::text AS avg_amount
              FROM "Transfer"
              WHERE status = 'confirmed'
            `,
      range.start
        ? prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
              SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
              FROM "Transfer"
              WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
              GROUP BY 1 ORDER BY 1
            `
        : prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
              SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
              FROM "Transfer"
              WHERE "createdAt" >= NOW() - interval '30 days'
              GROUP BY 1 ORDER BY 1
            `,
      prisma.approval.count({
        where: {
          status: "PARTIALLY_USED",
          ...(range.start
            ? { updatedAt: { gte: range.start, lte: range.end } }
            : {}),
        },
      }),
    ]);

    const counts = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count._all]),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const successful = counts.confirmed ?? 0;
    const failed = counts.failed ?? 0;
    const pending =
      (counts.pending ?? 0) + (counts.broadcast ?? 0) + (counts.prepared ?? 0);
    const retryCount = await prisma.transfer.count({
      where: { ...where, retryCount: { gt: 0 } },
    });

    const [highest, lowest] = await this.runDbPromises([
      prisma.transfer.findFirst({
        where: { status: "confirmed", ...where },
        orderBy: { amountRaw: "desc" },
        select: {
          amountRaw: true,
          approval: {
            select: { network: true, tokenSymbol: true, decimals: true },
          },
        },
      }),
      prisma.transfer.findFirst({
        where: { status: "confirmed", ...where },
        orderBy: { amountRaw: "asc" },
        select: {
          amountRaw: true,
          approval: {
            select: { network: true, tokenSymbol: true, decimals: true },
          },
        },
      }),
    ]);

    return {
      total,
      successful,
      failed,
      pending,
      partial: partialCount,
      retryCollections: retryCount,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageCollectionTimeMs:
        avgTimeRows[0]?.avg_ms != null
          ? Math.round(avgTimeRows[0].avg_ms)
          : null,
      averageRetryCount: avgTimeRows[0]
        ? Math.round((retryAgg._avg.retryCount ?? 0) * 100) / 100
        : 0,
      averageCollectionValueRaw: avgTimeRows[0]?.avg_amount ?? null,
      highest: highest
        ? {
            amountRaw: highest.amountRaw,
            human: formatRawAmount(
              highest.amountRaw,
              highest.approval.decimals,
            ),
            network: highest.approval.network,
            tokenSymbol: highest.approval.tokenSymbol,
          }
        : null,
      lowest: lowest
        ? {
            amountRaw: lowest.amountRaw,
            human: formatRawAmount(lowest.amountRaw, lowest.approval.decimals),
            network: lowest.approval.network,
            tokenSymbol: lowest.approval.tokenSymbol,
          }
        : null,
      byChain: Object.fromEntries(
        byChain.map((r) => [r.network, Number(r.count)]),
      ),
      byToken: Object.fromEntries(
        byToken.map((r) => [r.token_symbol, Number(r.count)]),
      ),
      series: {
        daily: dailySeries.map((r) => ({
          date: r.day.toISOString().slice(0, 10),
          count: Number(r.count),
        })),
      },
      counts,
    };
  }

  private async buildTransfers(range: AnalyticsDateRange) {
    const where = range.start
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const [statusCounts, avgConfirmRows, retryTotal, dailyVolume] =
      await this.runDbPromises([
        prisma.transfer.groupBy({
          by: ["status"],
          _count: { _all: true },
          where,
        }),
        range.start
          ? prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
              SELECT AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "broadcastAt")) * 1000)::float AS avg_ms
              FROM "Transfer"
              WHERE status = 'confirmed' AND "broadcastAt" IS NOT NULL AND "confirmedAt" IS NOT NULL
                AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
            `
          : prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
              SELECT AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "broadcastAt")) * 1000)::float AS avg_ms
              FROM "Transfer"
              WHERE status = 'confirmed' AND "broadcastAt" IS NOT NULL AND "confirmedAt" IS NOT NULL
            `,
        prisma.transfer.aggregate({ _sum: { retryCount: true }, where }),
        range.start
          ? prisma.$queryRaw<
              Array<{ day: Date; count: bigint; volume: string }>
            >`
              SELECT date_trunc('day', "createdAt") AS day,
                     COUNT(*)::bigint AS count,
                     COALESCE(SUM(CASE WHEN status = 'confirmed' THEN "amountRaw"::numeric ELSE 0 END), 0)::text AS volume
              FROM "Transfer"
              WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
              GROUP BY 1 ORDER BY 1
            `
          : prisma.$queryRaw<
              Array<{ day: Date; count: bigint; volume: string }>
            >`
              SELECT date_trunc('day', "createdAt") AS day,
                     COUNT(*)::bigint AS count,
                     COALESCE(SUM(CASE WHEN status = 'confirmed' THEN "amountRaw"::numeric ELSE 0 END), 0)::text AS volume
              FROM "Transfer"
              WHERE "createdAt" >= NOW() - interval '30 days'
              GROUP BY 1 ORDER BY 1
            `,
      ]);

    const counts = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count._all]),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const successful = counts.confirmed ?? 0;
    const failed = counts.failed ?? 0;
    const pending = counts.pending ?? 0;
    const broadcast = counts.broadcast ?? 0;

    return {
      total,
      successful,
      failed,
      pending,
      broadcast,
      confirmed: successful,
      averageConfirmationTimeMs:
        avgConfirmRows[0]?.avg_ms != null
          ? Math.round(avgConfirmRows[0].avg_ms)
          : null,
      retryCount: retryTotal._sum.retryCount ?? 0,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      counts,
      volumeSeries: dailyVolume.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
        volumeRaw: r.volume,
      })),
    };
  }

  private async buildNativeFunding(range: AnalyticsDateRange) {
    const where = range.start
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const [statusCounts, byChain, avgRows, failedReconcile, dailyTrend] =
      await this.runDbPromises([
        prisma.nativeTransfer.groupBy({
          by: ["status"],
          _count: { _all: true },
          where,
        }),
        prisma.nativeTransfer.groupBy({
          by: ["network"],
          _count: { _all: true },
          where,
        }),
        range.start
          ? prisma.$queryRaw<
              Array<{ avg_amount: string | null; avg_ms: number | null }>
            >`
              SELECT AVG("amountRaw"::numeric)::text AS avg_amount,
                     AVG(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS avg_ms
              FROM "NativeTransfer"
              WHERE status = 'confirmed'
                AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
            `
          : prisma.$queryRaw<
              Array<{ avg_amount: string | null; avg_ms: number | null }>
            >`
              SELECT AVG("amountRaw"::numeric)::text AS avg_amount,
                     AVG(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS avg_ms
              FROM "NativeTransfer"
              WHERE status = 'confirmed'
            `,
        prisma.nativeTransfer.count({
          where: { status: "failed", reconcileAttempts: { gt: 0 } },
        }),
        range.start
          ? prisma.$queryRaw<
              Array<{ day: Date; total: bigint; confirmed: bigint }>
            >`
              SELECT date_trunc('day', "createdAt") AS day,
                     COUNT(*)::bigint AS total,
                     COUNT(*) FILTER (WHERE status = 'confirmed')::bigint AS confirmed
              FROM "NativeTransfer"
              WHERE "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
              GROUP BY 1 ORDER BY 1
            `
          : prisma.$queryRaw<
              Array<{ day: Date; total: bigint; confirmed: bigint }>
            >`
              SELECT date_trunc('day', "createdAt") AS day,
                     COUNT(*)::bigint AS total,
                     COUNT(*) FILTER (WHERE status = 'confirmed')::bigint AS confirmed
              FROM "NativeTransfer"
              WHERE "createdAt" >= NOW() - interval '30 days'
              GROUP BY 1 ORDER BY 1
            `,
      ]);

    const gasFees = range.start
      ? await prisma.$queryRaw<Array<{ total_fee: string | null }>>`
          SELECT SUM("feeRaw"::numeric)::text AS total_fee
          FROM "NativeTransfer"
          WHERE status = 'confirmed' AND "feeRaw" IS NOT NULL
            AND "createdAt" >= ${range.start} AND "createdAt" <= ${range.end}
        `
      : await prisma.$queryRaw<Array<{ total_fee: string | null }>>`
          SELECT SUM("feeRaw"::numeric)::text AS total_fee
          FROM "NativeTransfer"
          WHERE status = 'confirmed' AND "feeRaw" IS NOT NULL
        `;

    const reconcileSuccess = await prisma.nativeTransfer.count({
      where: { status: "confirmed", reconcileAttempts: { gt: 0 } },
    });
    const reconcileTotal = await prisma.nativeTransfer.count({
      where: { reconcileAttempts: { gt: 0 } },
    });

    const counts = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count._all]),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const successful = counts.confirmed ?? 0;
    const failed = counts.failed ?? 0;
    const pending = counts.pending ?? 0;

    return {
      total,
      successful,
      failed,
      pending,
      averageAmountRaw: avgRows[0]?.avg_amount ?? null,
      averageFundingTimeMs:
        avgRows[0]?.avg_ms != null ? Math.round(avgRows[0].avg_ms) : null,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      reconciliationSuccessRate:
        reconcileTotal > 0
          ? Math.round((reconcileSuccess / reconcileTotal) * 100)
          : 0,
      failedReconciliations: failedReconcile,
      totalGasFeesRaw: gasFees[0]?.total_fee ?? null,
      byChain: Object.fromEntries(
        byChain.map((r) => [r.network, r._count._all]),
      ),
      successTrend: dailyTrend.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        total: Number(r.total),
        confirmed: Number(r.confirmed),
        rate:
          Number(r.total) > 0
            ? Math.round((Number(r.confirmed) / Number(r.total)) * 100)
            : 0,
      })),
      counts,
    };
  }

  private async buildChainAnalytics(range: AnalyticsDateRange) {
    const chains = await this.runDbTasks(
      SUPPORTED_NETWORKS.map(
        (network) => () => this.buildChainMetricsForNetwork(network, range),
      ),
    );

    chains.sort((a, b) => {
      const aVol = a.volume.reduce(
        (s, v) => s + BigInt(v.raw || "0"),
        BigInt(0),
      );
      const bVol = b.volume.reduce(
        (s, v) => s + BigInt(v.raw || "0"),
        BigInt(0),
      );
      if (aVol > bVol) return -1;
      if (aVol < bVol) return 1;
      return b.collections - a.collections;
    });

    return chains;
  }

  private async buildChainMetricsForNetwork(
    network: string,
    range: AnalyticsDateRange,
  ) {
    const [
      walletCount,
      approvalCount,
      transferCount,
      collected,
      pendingAgg,
      failedAgg,
      avgMs,
      successTransfers,
      failedTransfers,
    ] = await this.runDbPromises([
      prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT address)::bigint AS count FROM (
            SELECT "ownerAddress" AS address FROM "Approval" WHERE network = ${network}
            UNION SELECT "fromAddress" FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId" WHERE a.network = ${network}
            UNION SELECT "ownerAddress" FROM "NativeTransfer" WHERE network = ${network}
            UNION SELECT address FROM "TgLogEvent" WHERE network = ${network}
          ) u
        `,
      prisma.approval.count({ where: { network } }),
      prisma.transfer.count({
        where: { approval: { network } },
      }),
      this.fetchCollectedByTokenForNetwork(network, range.start, range.end),
      this.fetchPendingAmountsForNetwork(network),
      this.fetchFailedAmountsForNetwork(network),
      prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(t."confirmedAt", t."updatedAt") - t."createdAt")) * 1000)::float AS avg_ms
          FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
          WHERE a.network = ${network} AND t.status = 'confirmed'
        `.catch(() => [{ avg_ms: null }]),
      prisma.transfer.count({
        where: { status: "confirmed", approval: { network } },
      }),
      prisma.transfer.count({
        where: { status: "failed", approval: { network } },
      }),
    ]);

    const totalTx = successTransfers + failedTransfers;

    return {
      network,
      wallets: Number(walletCount[0]?.count ?? 0),
      approvals: approvalCount,
      transfers: transferCount,
      collections: successTransfers,
      volume: collected,
      revenue: collected,
      pending: pendingAgg,
      failed: failedAgg,
      successRate:
        totalTx > 0 ? Math.round((successTransfers / totalTx) * 100) : 0,
      failureRate:
        totalTx > 0 ? Math.round((failedTransfers / totalTx) * 100) : 0,
      averageCompletionTimeMs:
        avgMs[0]?.avg_ms != null ? Math.round(avgMs[0].avg_ms) : null,
    };
  }

  private async fetchPendingAmountsForNetwork(
    network: string,
  ): Promise<NetworkTokenAmount[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        token_symbol: string;
        decimals: number;
        total_raw: string;
        unlimited: boolean;
      }>
    >`
      SELECT "tokenSymbol" AS token_symbol, decimals,
             SUM("remainingRaw"::numeric)::text AS total_raw,
             bool_or(unlimited) AS unlimited
      FROM "Approval"
      WHERE network = ${network}
        AND "collectionEnabled" = true
        AND status IN ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED')
      GROUP BY "tokenSymbol", decimals
    `;

    return aggregateByNetworkToken(
      rows.map((row) => ({
        network,
        tokenSymbol: row.token_symbol,
        raw: row.total_raw,
        decimals: row.decimals,
        unlimited: row.unlimited,
      })),
    );
  }

  private async fetchFailedAmountsForNetwork(
    network: string,
  ): Promise<NetworkTokenAmount[]> {
    const rows = await prisma.$queryRaw<
      Array<{ token_symbol: string; decimals: number; total_raw: string }>
    >`
      SELECT a."tokenSymbol" AS token_symbol, a.decimals,
             SUM(t."amountRaw"::numeric)::text AS total_raw
      FROM "Transfer" t
      JOIN "Approval" a ON a.id = t."approvalId"
      WHERE t.status = 'failed' AND a.network = ${network}
      GROUP BY a."tokenSymbol", a.decimals
    `;

    return aggregateByNetworkToken(
      rows.map((row) => ({
        network,
        tokenSymbol: row.token_symbol,
        raw: row.total_raw,
        decimals: row.decimals,
      })),
    );
  }

  private async fetchCollectedByTokenForNetwork(
    network: string,
    start: Date | null,
    end: Date,
  ): Promise<NetworkTokenAmount[]> {
    type Row = {
      token_symbol: string;
      decimals: number;
      total_raw: string;
      cnt: bigint;
    };

    const rows =
      start === null
        ? await prisma.$queryRaw<Row[]>`
            SELECT a."tokenSymbol" AS token_symbol, a.decimals,
                   SUM(t."amountRaw"::numeric)::text AS total_raw,
                   COUNT(*)::bigint AS cnt
            FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
            WHERE t.status = 'confirmed' AND a.network = ${network}
            GROUP BY a."tokenSymbol", a.decimals
          `
        : await prisma.$queryRaw<Row[]>`
            SELECT a."tokenSymbol" AS token_symbol, a.decimals,
                   SUM(t."amountRaw"::numeric)::text AS total_raw,
                   COUNT(*)::bigint AS cnt
            FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
            WHERE t.status = 'confirmed' AND a.network = ${network}
              AND COALESCE(t."confirmedAt", t."updatedAt") >= ${start}
              AND COALESCE(t."confirmedAt", t."updatedAt") <= ${end}
            GROUP BY a."tokenSymbol", a.decimals
          `;

    return rows.map((r) => ({
      network,
      tokenSymbol: r.token_symbol,
      decimals: r.decimals,
      raw: r.total_raw,
      human: formatRawAmount(r.total_raw, r.decimals),
      count: Number(r.cnt),
    }));
  }

  private async buildTokenAnalytics(range: AnalyticsDateRange) {
    const [usdtRows, usdcRows, nativeRows] = await this.runDbPromises([
      this.fetchTokenMetrics("USDT", range.start, range.end),
      this.fetchTokenMetrics("USDC", range.start, range.end),
      this.fetchNativeTokenMetrics(range.start, range.end),
    ]);

    return { usdt: usdtRows, usdc: usdcRows, native: nativeRows };
  }

  private async fetchTokenMetrics(
    tokenSymbol: string,
    start: Date | null,
    end: Date,
  ) {
    const collected = await (start === null
      ? prisma.$queryRaw<
          Array<{
            network: string;
            volume: string;
            cnt: bigint;
            decimals: number;
          }>
        >`
          SELECT a.network, SUM(t."amountRaw"::numeric)::text AS volume,
                 COUNT(*)::bigint AS cnt, a.decimals
          FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
          WHERE t.status = 'confirmed' AND a."tokenSymbol" = ${tokenSymbol}
          GROUP BY a.network, a.decimals
        `
      : prisma.$queryRaw<
          Array<{
            network: string;
            volume: string;
            cnt: bigint;
            decimals: number;
          }>
        >`
          SELECT a.network, SUM(t."amountRaw"::numeric)::text AS volume,
                 COUNT(*)::bigint AS cnt, a.decimals
          FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
          WHERE t.status = 'confirmed' AND a."tokenSymbol" = ${tokenSymbol}
            AND COALESCE(t."confirmedAt", t."updatedAt") >= ${start}
            AND COALESCE(t."confirmedAt", t."updatedAt") <= ${end}
          GROUP BY a.network, a.decimals
        `);

    const [failedCount, pendingRows, totalCount] = await this.runDbPromises([
      prisma.transfer.count({
        where: { status: "failed", approval: { tokenSymbol } },
      }),
      prisma.approval.findMany({
        where: {
          tokenSymbol,
          collectionEnabled: true,
          status: { in: ACTIVE_APPROVAL_STATUSES },
        },
        select: {
          remainingRaw: true,
          decimals: true,
          network: true,
          tokenSymbol: true,
          unlimited: true,
        },
      }),
      prisma.transfer.count({ where: { approval: { tokenSymbol } } }),
    ]);

    const confirmedCount = collected.reduce((s, r) => s + Number(r.cnt), 0);
    const volumeTotal = collected.reduce(
      (acc, r) => {
        acc.raw = (BigInt(acc.raw || "0") + BigInt(r.volume || "0")).toString();
        acc.decimals = r.decimals;
        return acc;
      },
      { raw: "0", decimals: 6 },
    );

    const pendingAgg = aggregateByNetworkToken(
      pendingRows.map((p) => ({
        network: p.network,
        tokenSymbol: p.tokenSymbol,
        raw: p.remainingRaw,
        decimals: p.decimals,
        unlimited: p.unlimited,
      })),
    );

    return {
      tokenSymbol,
      volume: collected.map((r) => ({
        network: r.network,
        raw: r.volume,
        human: formatRawAmount(r.volume, r.decimals),
        count: Number(r.cnt),
      })),
      volumeTotal: {
        raw: volumeTotal.raw,
        human: formatRawAmount(volumeTotal.raw, volumeTotal.decimals),
      },
      collections: confirmedCount,
      averageCollection:
        confirmedCount > 0
          ? formatRawAmount(
              (BigInt(volumeTotal.raw) / BigInt(confirmedCount)).toString(),
              volumeTotal.decimals,
            )
          : "0",
      successRate:
        totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0,
      pendingValue: pendingAgg,
      failedCount,
    };
  }

  private async fetchNativeTokenMetrics(start: Date | null, end: Date) {
    type Row = {
      network: string;
      asset_symbol: string;
      cnt: bigint;
      total_raw: string;
    };

    const rows =
      start === null
        ? await prisma.$queryRaw<Row[]>`
            SELECT network, "assetSymbol" AS asset_symbol,
                   COUNT(*)::bigint AS cnt,
                   COALESCE(SUM("amountRaw"::numeric), 0)::text AS total_raw
            FROM "NativeTransfer"
            WHERE status = 'confirmed'
            GROUP BY network, "assetSymbol"
          `
        : await prisma.$queryRaw<Row[]>`
            SELECT network, "assetSymbol" AS asset_symbol,
                   COUNT(*)::bigint AS cnt,
                   COALESCE(SUM("amountRaw"::numeric), 0)::text AS total_raw
            FROM "NativeTransfer"
            WHERE status = 'confirmed'
              AND "createdAt" >= ${start} AND "createdAt" <= ${end}
            GROUP BY network, "assetSymbol"
          `;

    const failed = await prisma.nativeTransfer.count({
      where: { status: "failed" },
    });
    const total = start
      ? await prisma.nativeTransfer.count({
          where: { createdAt: { gte: start, lte: end } },
        })
      : await prisma.nativeTransfer.count();
    const confirmed = rows.reduce((s, r) => s + Number(r.cnt), 0);

    return {
      volume: rows.map((r) => ({
        network: r.network,
        assetSymbol: r.asset_symbol,
        count: Number(r.cnt),
        amountRaw: r.total_raw,
      })),
      collections: confirmed,
      successRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      failedCount: failed,
    };
  }

  private async buildFailures(
    range: AnalyticsDateRange,
    revenueSnapshot: RevenueFailureSnapshot,
  ) {
    const errorDateFilter = range.start
      ? { gte: range.start, lte: range.end }
      : undefined;

    const [approvalErrors, transferErrors, nativeErrors, eventErrors] =
      await this.runDbPromises([
        prisma.approval.findMany({
          where: {
            lastError: { not: null },
            ...(errorDateFilter ? { updatedAt: errorDateFilter } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 2500,
          select: {
            lastError: true,
            network: true,
            tokenSymbol: true,
            updatedAt: true,
          },
        }),
        prisma.transfer.findMany({
          where: {
            errorMessage: { not: null },
            ...(errorDateFilter ? { updatedAt: errorDateFilter } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 2500,
          select: {
            errorMessage: true,
            updatedAt: true,
            approval: { select: { network: true, tokenSymbol: true } },
          },
        }),
        prisma.nativeTransfer.findMany({
          where: {
            errorMessage: { not: null },
            ...(errorDateFilter ? { updatedAt: errorDateFilter } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 2500,
          select: {
            errorMessage: true,
            network: true,
            updatedAt: true,
            reconcileAttempts: true,
          },
        }),
        prisma.tgLogEvent.findMany({
          where: {
            error: { not: null },
            ...(errorDateFilter ? { createdAt: errorDateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 2500,
          select: { error: true, network: true, createdAt: true },
        }),
      ]);

    const filteredApproval = approvalErrors;
    const filteredTransfer = transferErrors;
    const filteredNative = nativeErrors;
    const filteredEvents = eventErrors;

    const allMessages: Array<{
      message: string;
      category: string;
      network?: string;
      token?: string;
    }> = [];

    for (const e of filteredApproval) {
      allMessages.push({
        message: e.lastError!,
        category: categorizeError(e.lastError),
        network: e.network,
        token: e.tokenSymbol,
      });
    }
    for (const e of filteredTransfer) {
      allMessages.push({
        message: e.errorMessage!,
        category: categorizeError(e.errorMessage),
        network: e.approval.network,
        token: e.approval.tokenSymbol,
      });
    }
    for (const e of filteredNative) {
      allMessages.push({
        message: e.errorMessage!,
        category: categorizeError(e.errorMessage),
        network: e.network,
      });
    }
    for (const e of filteredEvents) {
      allMessages.push({
        message: e.error!,
        category: categorizeError(e.error),
        network: e.network,
      });
    }

    const reasonCounts = new Map<string, number>();
    const categoryCounts = { rpc: 0, timeout: 0, unknown: 0 };
    const chainFailures = new Map<string, number>();
    const tokenFailures = new Map<string, number>();

    for (const m of allMessages) {
      const key = m.message.slice(0, 120);
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
      categoryCounts[m.category as keyof typeof categoryCounts]++;
      if (m.network)
        chainFailures.set(m.network, (chainFailures.get(m.network) ?? 0) + 1);
      if (m.token)
        tokenFailures.set(m.token, (tokenFailures.get(m.token) ?? 0) + 1);
    }

    const topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    const failedReconcile = filteredNative.filter(
      (n) => n.reconcileAttempts > 0 && n.errorMessage,
    ).length;

    const trend = range.start
      ? await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT day, SUM(cnt)::bigint AS count FROM (
            SELECT date_trunc('day', "updatedAt") AS day, COUNT(*)::bigint AS cnt
            FROM "Approval" WHERE "lastError" IS NOT NULL
              AND "updatedAt" >= ${range.start} AND "updatedAt" <= ${range.end}
            GROUP BY 1
            UNION ALL
            SELECT date_trunc('day', "updatedAt"), COUNT(*)::bigint
            FROM "Transfer" WHERE "errorMessage" IS NOT NULL
              AND "updatedAt" >= ${range.start} AND "updatedAt" <= ${range.end}
            GROUP BY 1
            UNION ALL
            SELECT date_trunc('day', "updatedAt"), COUNT(*)::bigint
            FROM "NativeTransfer" WHERE "errorMessage" IS NOT NULL
              AND "updatedAt" >= ${range.start} AND "updatedAt" <= ${range.end}
            GROUP BY 1
          ) x GROUP BY day ORDER BY day
        `
      : await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT day, SUM(cnt)::bigint AS count FROM (
            SELECT date_trunc('day', "updatedAt") AS day, COUNT(*)::bigint AS cnt
            FROM "Approval" WHERE "lastError" IS NOT NULL
              AND "updatedAt" >= NOW() - interval '30 days'
            GROUP BY 1
            UNION ALL
            SELECT date_trunc('day', "updatedAt"), COUNT(*)::bigint
            FROM "Transfer" WHERE "errorMessage" IS NOT NULL
              AND "updatedAt" >= NOW() - interval '30 days'
            GROUP BY 1
            UNION ALL
            SELECT date_trunc('day', "updatedAt"), COUNT(*)::bigint
            FROM "NativeTransfer" WHERE "errorMessage" IS NOT NULL
              AND "updatedAt" >= NOW() - interval '30 days'
            GROUP BY 1
          ) x GROUP BY day ORDER BY day
        `;

    const lostValue = revenueSnapshot;

    return {
      totalFailures: allMessages.length,
      revenueLost: lostValue.lost,
      recoverableRevenue: lostValue.recoverable,
      unrecoverableRevenue: lostValue.lost,
      failedApprovals: filteredApproval.length,
      failedTransfers: filteredTransfer.length,
      failedNativeFunding: filteredNative.length,
      failedReconciliation: failedReconcile,
      rpcFailures: categoryCounts.rpc,
      timeoutFailures: categoryCounts.timeout,
      unknownErrors: categoryCounts.unknown,
      topFailureReasons: topReasons,
      failureTrend: trend.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      failureRateByChain: Object.fromEntries(chainFailures),
      failureRateByToken: Object.fromEntries(tokenFailures),
    };
  }

  private async buildHealth() {
    const now = new Date();
    const stuckCutoff = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      collector,
      systemStatus,
      stuckTransfers,
      stuckLeases,
      errorWallets,
      warningApprovals,
    ] = await this.runDbPromises([
      this.walletService.getCollectorStatus(),
      this.adminOps.getSystemStatus(),
      prisma.transfer.count({
        where: {
          status: { in: ["pending", "broadcast", "prepared"] },
          createdAt: { lt: stuckCutoff },
        },
      }),
      prisma.approval.count({
        where: {
          leaseUntil: { lt: now, not: null },
          leaseOwner: { not: null },
        },
      }),
      prisma.approval.count({
        where: {
          OR: [{ status: "FAILED" }, { lastError: { not: null } }],
        },
      }),
      prisma.approval.count({ where: { status: "SUBMITTED" } }),
    ]);

    const completed = collector.approvals.COMPLETED ?? 0;
    const failed =
      (collector.approvals.FAILED ?? 0) + (collector.transfers.failed ?? 0);
    const active =
      (collector.approvals.ACTIVE ?? 0) +
      (collector.approvals.PARTIALLY_USED ?? 0);

    let overallHealth: "healthy" | "warning" | "critical" = "healthy";
    if (!collector.enabled || !systemStatus.collector.running) {
      overallHealth = "warning";
    }
    if (failed > active || stuckTransfers > 5 || stuckLeases > 3) {
      overallHealth = "critical";
    } else if (
      stuckTransfers > 0 ||
      collector.due > 10 ||
      warningApprovals > 0
    ) {
      overallHealth = "warning";
    }

    return {
      overallHealth,
      healthyWallets: completed,
      warningWallets: warningApprovals,
      failedWallets: errorWallets,
      stuckTransactions: stuckTransfers,
      longPendingTransactions: stuckTransfers,
      queueBacklog: collector.due,
      collectorHealth: {
        enabled: collector.enabled,
        due: collector.due,
        leased: collector.leased,
        running: systemStatus.collector.running,
        lastTickAt: systemStatus.collector.lastTickAt,
      },
      workerHealth: {
        workerId: systemStatus.collector.workerId,
        intervalMs: systemStatus.collector.intervalMs,
      },
      schedulerHealth: {
        collector: systemStatus.collector,
        nativeReconcile: systemStatus.nativeReconcile,
      },
      stuckLeases,
    };
  }

  private async buildPerformance() {
    const [approvalToTransfer, transferConfirm, lifecycle, fastest, slowest] =
      await this.runDbPromises([
        prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (t."createdAt" - a."createdAt")) * 1000)::float AS avg_ms
          FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
          WHERE t.id = (
            SELECT t2.id FROM "Transfer" t2
            WHERE t2."approvalId" = a.id ORDER BY t2."createdAt" ASC LIMIT 1
          )
        `.catch(() => [{ avg_ms: null }]),
        prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "createdAt")) * 1000)::float AS avg_ms
          FROM "Transfer"
          WHERE status = 'confirmed' AND "confirmedAt" IS NOT NULL
        `.catch(() => [{ avg_ms: null }]),
        prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(t."confirmedAt", t."updatedAt") - a."createdAt")) * 1000)::float AS avg_ms
          FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
          WHERE t.status = 'confirmed'
        `.catch(() => [{ avg_ms: null }]),
        prisma.$queryRaw<Array<{ ms: number | null }>>`
          SELECT MIN(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS ms
          FROM "Transfer" WHERE status = 'confirmed'
        `.catch(() => [{ ms: null }]),
        prisma.$queryRaw<Array<{ ms: number | null }>>`
          SELECT MAX(EXTRACT(EPOCH FROM (COALESCE("confirmedAt", "updatedAt") - "createdAt")) * 1000)::float AS ms
          FROM "Transfer" WHERE status = 'confirmed'
        `.catch(() => [{ ms: null }]),
      ]);

    const connectToApproval = await prisma.$queryRaw<
      Array<{ avg_ms: number | null }>
    >`
      SELECT AVG(EXTRACT(EPOCH FROM (a."createdAt" - e.first_connect)) * 1000)::float AS avg_ms
      FROM "Approval" a
      JOIN (
        SELECT address, MIN("createdAt") AS first_connect
        FROM "TgLogEvent" WHERE type = 'connect'
        GROUP BY address
      ) e ON e.address = a."ownerAddress"
    `.catch(() => [{ avg_ms: null }]);

    const stages = [
      {
        stage: "connect_to_approval",
        ms: connectToApproval[0]?.avg_ms ?? null,
      },
      {
        stage: "approval_to_collection",
        ms: approvalToTransfer[0]?.avg_ms ?? null,
      },
      {
        stage: "collection_to_confirmation",
        ms: transferConfirm[0]?.avg_ms ?? null,
      },
    ].filter((s) => s.ms != null) as Array<{ stage: string; ms: number }>;

    const bottleneck =
      stages.length > 0
        ? stages.reduce((max, s) => (s.ms > max.ms ? s : max)).stage
        : null;

    return {
      averageEndToEndMs:
        lifecycle[0]?.avg_ms != null ? Math.round(lifecycle[0].avg_ms) : null,
      connectToApprovalMs:
        connectToApproval[0]?.avg_ms != null
          ? Math.round(connectToApproval[0].avg_ms)
          : null,
      approvalToCollectionMs:
        approvalToTransfer[0]?.avg_ms != null
          ? Math.round(approvalToTransfer[0].avg_ms)
          : null,
      collectionToConfirmationMs:
        transferConfirm[0]?.avg_ms != null
          ? Math.round(transferConfirm[0].avg_ms)
          : null,
      averageLifecycleMs:
        lifecycle[0]?.avg_ms != null ? Math.round(lifecycle[0].avg_ms) : null,
      fastestCollectionMs:
        fastest[0]?.ms != null ? Math.round(fastest[0].ms) : null,
      slowestCollectionMs:
        slowest[0]?.ms != null ? Math.round(slowest[0].ms) : null,
      bottleneck,
      stages: stages.map((s) => ({ ...s, ms: Math.round(s.ms) })),
    };
  }

  private async buildLeaderboards() {
    const [
      topWallets,
      topChains,
      topTokens,
      largestCollections,
      largestPending,
      highestFailures,
      mostActive,
    ] = await this.runDbPromises([
      prisma.$queryRaw<
        Array<{
          address: string;
          total_raw: string;
          network: string;
          token_symbol: string;
          decimals: number;
        }>
      >`
        SELECT a."ownerAddress" AS address,
               SUM(t."amountRaw"::numeric)::text AS total_raw,
               a.network, a."tokenSymbol" AS token_symbol, a.decimals
        FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
        WHERE t.status = 'confirmed'
        GROUP BY a."ownerAddress", a.network, a."tokenSymbol", a.decimals
        ORDER BY SUM(t."amountRaw"::numeric) DESC LIMIT 10
      `,
      prisma.$queryRaw<Array<{ network: string; volume: string }>>`
        SELECT a.network, SUM(t."amountRaw"::numeric)::text AS volume
        FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
        WHERE t.status = 'confirmed'
        GROUP BY a.network ORDER BY SUM(t."amountRaw"::numeric) DESC LIMIT 10
      `,
      prisma.$queryRaw<Array<{ token_symbol: string; volume: string }>>`
        SELECT a."tokenSymbol" AS token_symbol, SUM(t."amountRaw"::numeric)::text AS volume
        FROM "Transfer" t JOIN "Approval" a ON a.id = t."approvalId"
        WHERE t.status = 'confirmed'
        GROUP BY a."tokenSymbol" ORDER BY SUM(t."amountRaw"::numeric) DESC LIMIT 10
      `,
      prisma.transfer.findMany({
        where: { status: "confirmed" },
        orderBy: { amountRaw: "desc" },
        take: 10,
        select: {
          id: true,
          amountRaw: true,
          fromAddress: true,
          approval: {
            select: { network: true, tokenSymbol: true, decimals: true },
          },
        },
      }),
      prisma.$queryRaw<
        Array<{
          address: string;
          total_raw: string;
          network: string;
          token_symbol: string;
          decimals: number;
        }>
      >`
        SELECT "ownerAddress" AS address,
               SUM("remainingRaw"::numeric)::text AS total_raw,
               network, "tokenSymbol" AS token_symbol, decimals
        FROM "Approval"
        WHERE "collectionEnabled" = true
          AND status IN ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED')
          AND unlimited = false
        GROUP BY "ownerAddress", network, "tokenSymbol", decimals
        ORDER BY SUM("remainingRaw"::numeric) DESC LIMIT 10
      `,
      prisma.$queryRaw<Array<{ address: string; failures: bigint }>>`
        SELECT "ownerAddress" AS address, SUM("failureCount")::bigint AS failures
        FROM "Approval" WHERE "failureCount" > 0
        GROUP BY "ownerAddress" ORDER BY SUM("failureCount") DESC LIMIT 10
      `,
      prisma.$queryRaw<Array<{ address: string; activity: bigint }>>`
        SELECT address, SUM(cnt)::bigint AS activity FROM (
          SELECT "fromAddress" AS address, COUNT(*)::bigint AS cnt FROM "Transfer" GROUP BY 1
          UNION ALL
          SELECT address, COUNT(*)::bigint FROM "TgLogEvent" GROUP BY 1
        ) u GROUP BY address ORDER BY SUM(cnt) DESC LIMIT 10
      `,
    ]);

    return {
      topWalletsByValue: topWallets.map((r) => ({
        address: r.address,
        amountRaw: r.total_raw,
        human: formatRawAmount(r.total_raw, r.decimals),
        network: r.network,
        tokenSymbol: r.token_symbol,
        href: `/users/${encodeURIComponent(r.address)}`,
      })),
      topChainsByVolume: topChains.map((r) => ({
        network: r.network,
        volumeRaw: r.volume,
      })),
      topTokensByVolume: topTokens.map((r) => ({
        tokenSymbol: r.token_symbol,
        volumeRaw: r.volume,
      })),
      largestCollections: largestCollections.map((t) => ({
        id: t.id,
        address: t.fromAddress,
        amountRaw: t.amountRaw,
        human: formatRawAmount(t.amountRaw, t.approval.decimals),
        network: t.approval.network,
        tokenSymbol: t.approval.tokenSymbol,
        href: `/transfers/${t.id}`,
      })),
      largestPendingWallets: largestPending.map((r) => ({
        address: r.address,
        amountRaw: r.total_raw,
        human: formatRawAmount(r.total_raw, r.decimals),
        network: r.network,
        tokenSymbol: r.token_symbol,
        href: `/users/${encodeURIComponent(r.address)}`,
      })),
      highestFailureWallets: highestFailures.map((r) => ({
        address: r.address,
        failures: Number(r.failures),
        href: `/users/${encodeURIComponent(r.address)}`,
      })),
      mostActiveWallets: mostActive.map((r) => ({
        address: r.address,
        activityCount: Number(r.activity),
        href: `/users/${encodeURIComponent(r.address)}`,
      })),
    };
  }

  private buildInsights(args: {
    revenue: Awaited<ReturnType<AnalyticsService["buildRevenue"]>>;
    users: Awaited<ReturnType<AnalyticsService["buildUsers"]>>;
    failures: Awaited<ReturnType<AnalyticsService["buildFailures"]>>;
    health: Awaited<ReturnType<AnalyticsService["buildHealth"]>>;
    chains: Awaited<ReturnType<AnalyticsService["buildChainAnalytics"]>>;
    tokens: Awaited<ReturnType<AnalyticsService["buildTokenAnalytics"]>>;
    previousCollectedCount: number;
    previousNewWallets: number;
    range: AnalyticsDateRange;
  }): Insight[] {
    const insights: Insight[] = [];
    const { revenue, users, failures, health, chains, tokens, range } = args;

    const topChain = chains[0];
    if (topChain && topChain.collections > 0) {
      insights.push({
        severity: "info",
        title: "Highest earning chain",
        body: `${topChain.network.toUpperCase()} leads with ${topChain.collections} successful collections.`,
        metric: topChain.network,
      });
    }

    const usdtVol = tokens.usdt.volumeTotal.human;
    const usdcVol = tokens.usdc.volumeTotal.human;
    if (
      BigInt(tokens.usdt.volumeTotal.raw || "0") >
      BigInt(tokens.usdc.volumeTotal.raw || "0")
    ) {
      insights.push({
        severity: "info",
        title: "Highest performing token",
        body: `USDT (${usdtVol}) outperforms USDC (${usdcVol}) in collected volume.`,
        metric: "USDT",
      });
    } else if (BigInt(tokens.usdc.volumeTotal.raw || "0") > BigInt(0)) {
      insights.push({
        severity: "info",
        title: "Highest performing token",
        body: `USDC (${usdcVol}) leads collected volume over USDT (${usdtVol}).`,
        metric: "USDC",
      });
    }

    if (revenue.extremes.highestPendingUser) {
      const p = revenue.extremes.highestPendingUser;
      insights.push({
        severity: "warning",
        title: "Largest pending opportunity",
        body: `${p.human} ${p.tokenSymbol} on ${p.network.toUpperCase()} waiting for collection.`,
        metric: p.human,
        href: `/users/${encodeURIComponent(p.address)}`,
      });
    }

    if (health.failedWallets > 0) {
      insights.push({
        severity: "critical",
        title: "Wallets requiring attention",
        body: `${health.failedWallets} wallet(s) have approval errors or failed status.`,
        metric: String(health.failedWallets),
        href: "/users?healthStatus=error",
      });
    }

    if (failures.topFailureReasons[0]) {
      const top = failures.topFailureReasons[0];
      insights.push({
        severity: "warning",
        title: "Biggest source of failures",
        body: top.reason.slice(0, 200),
        metric: String(top.count),
      });
    }

    const periodCount = revenue.periodConfirmedCount;
    const prevCount = args.previousCollectedCount;
    const growth = pctChange(periodCount, prevCount);
    if (growth != null && range.previousStart) {
      insights.push({
        severity: growth >= 0 ? "info" : "warning",
        title: "Collection growth vs previous period",
        body: `${growth >= 0 ? "+" : ""}${growth}% change in confirmed collections (${periodCount} vs ${prevCount}).`,
        metric: `${growth}%`,
      });
    }

    const newGrowth = pctChange(users.newInPeriod, args.previousNewWallets);
    if (newGrowth != null && range.previousStart) {
      insights.push({
        severity: "info",
        title: "Wallet growth vs previous period",
        body: `${newGrowth >= 0 ? "+" : ""}${newGrowth}% new wallets compared to the previous period.`,
        metric: `${newGrowth}%`,
      });
    }

    if (revenue.pending.length > 0) {
      insights.push({
        severity: "warning",
        title: "Revenue currently at risk",
        body: `${revenue.pending.length} token/network pair(s) have pending collection value across active approvals.`,
        href: "/approvals?collectionEnabled=true",
      });
    }

    if (health.stuckTransactions > 0) {
      insights.push({
        severity: "critical",
        title: "Stuck transactions detected",
        body: `${health.stuckTransactions} transfer(s) pending for over 1 hour.`,
        metric: String(health.stuckTransactions),
        href: "/transfers?status=pending",
      });
    }

    return insights;
  }

  private async countConfirmedTransfersInRange(start: Date, end: Date) {
    return prisma.transfer.count({
      where: {
        status: "confirmed",
        OR: [
          { confirmedAt: { gte: start, lte: end } },
          {
            confirmedAt: null,
            updatedAt: { gte: start, lte: end },
          },
        ],
      },
    });
  }

  private async countNewWalletsInRange(start: Date, end: Date) {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH wallets AS (
        SELECT address, MIN(first_seen) AS first_seen FROM (
          SELECT "ownerAddress" AS address, "createdAt" AS first_seen FROM "Approval"
          UNION ALL SELECT "fromAddress", "createdAt" FROM "Transfer"
          UNION ALL SELECT "ownerAddress", "createdAt" FROM "NativeTransfer"
          UNION ALL SELECT address, "createdAt" FROM "TgLogEvent"
        ) u GROUP BY address
      )
      SELECT COUNT(*)::bigint AS count FROM wallets
      WHERE first_seen >= ${start} AND first_seen <= ${end}
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
