"use client";

import Link from "next/link";
import {
  StatusBarChart,
  StatusDonutChart,
} from "@/components/charts/StatusCharts";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import {
  BentoCell,
  BentoMetrics,
  BentoPanel,
  BentoRow,
  BentoSection,
} from "@/components/analytics/BentoGrid";
import { AssetCard, CompactMetric } from "@/components/analytics/CompactMetric";
import { AnalyticsExecutiveSummary } from "@/components/analytics/AnalyticsExecutiveSummary";
import { InsightsPanel } from "@/components/analytics/InsightsPanel";
import { LeaderboardsPanel } from "@/components/analytics/LeaderboardsPanel";
import { LiveActivityFeed } from "@/components/analytics/LiveActivityFeed";
import { buttonVariants } from "@/components/ui/button";
import {
  buildLifetimeAssetCards,
  chainApprovalRateChart,
  chainCollectionsChart,
  chainUsersChart,
  collectionsPerUser,
  failureCategoryChart,
  latencyChart,
  lifetimeCollectionTotal,
  newVsReturningChart,
  periodCollectionTotal,
  revenueByChainChart,
  revenueByTokenChart,
  revenueDistributionChartData,
  revenueFunnelChart,
  revenueLossChart,
  tokenPerChainChart,
  userWorkflowChart,
} from "@/lib/analytics-present";
import { formatMs, formatTokenAmounts } from "@/lib/analytics-format";
import type { AnalyticsResponse } from "@/types/analytics";

export function AnalyticsDashboard({ data }: { data: AnalyticsResponse }) {
  const lifetimeAssets = buildLifetimeAssetCards(data);
  const distribution = revenueDistributionChartData(lifetimeAssets);
  const lifetimeTotal = lifetimeCollectionTotal(data);
  const periodTotal = periodCollectionTotal(data);

  return (
    <div className="space-y-10 pb-8">
      <AnalyticsExecutiveSummary data={data} />

      {/* ——— Lifetime ——— */}
      <BentoSection
        id="lifetime"
        title="Lifetime revenue"
        description="Collected stablecoin volume by asset — per-token, not USD-equivalent"
      >
        <BentoRow minHeight="min-h-[260px]">
          <BentoCell span={7}>
            <BentoPanel className="h-full" padding="default">
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Total lifetime collections
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                    {lifetimeTotal.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {periodTotal.toLocaleString()} in selected period ·{" "}
                    {data.revenue.confirmedTransferCount.toLocaleString()} confirmed all-time
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {lifetimeAssets.length === 0 ? (
                    <p className="col-span-full text-xs text-muted-foreground">No collection data yet</p>
                  ) : (
                    lifetimeAssets.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        label={asset.label}
                        value={asset.human}
                        share={asset.share}
                        sub={`${asset.collections.toLocaleString()} collections`}
                      />
                    ))
                  )}
                </div>
              </div>
            </BentoPanel>
          </BentoCell>
          <BentoCell span={5}>
            <StatusDonutChart title="Distribution by asset" data={distribution} bento />
          </BentoCell>
        </BentoRow>
      </BentoSection>

      {/* ——— Revenue ——— */}
      <BentoSection id="revenue" title="Revenue">
        <BentoRow>
          <BentoMetrics>
            <CompactMetric label="Period collected" value={periodTotal} />
            <CompactMetric
              label="Today"
              value={data.revenue.collected.today.reduce((s, i) => s + (i.count ?? 0), 0)}
            />
            <CompactMetric
              label="This week"
              value={data.revenue.collected.thisWeek.reduce((s, i) => s + (i.count ?? 0), 0)}
            />
            <CompactMetric
              label="This month"
              value={data.revenue.collected.thisMonth.reduce((s, i) => s + (i.count ?? 0), 0)}
            />
            <CompactMetric
              label="Pending"
              value={formatTokenAmounts(data.revenue.pending, 1)}
              accent="warning"
            />
            <CompactMetric
              label="Recoverable"
              value={formatTokenAmounts(data.revenue.recoverable, 1)}
              accent="success"
            />
          </BentoMetrics>
        </BentoRow>
        <BentoRow>
          <BentoMetrics>
            <CompactMetric label="Lost" value={formatTokenAmounts(data.revenue.lost, 1)} accent="danger" />
            <CompactMetric
              label="Largest collection"
              value={data.revenue.extremes.largestCollection?.human ?? "—"}
              hint={
                data.revenue.extremes.largestCollection
                  ? `${data.revenue.extremes.largestCollection.network.toUpperCase()} ${data.revenue.extremes.largestCollection.tokenSymbol}`
                  : undefined
              }
            />
            <CompactMetric
              label="Top pending wallet"
              value={data.revenue.extremes.highestPendingUser?.human ?? "—"}
              hint={
                data.revenue.extremes.highestPendingUser
                  ? `${data.revenue.extremes.highestPendingUser.network.toUpperCase()} ${data.revenue.extremes.highestPendingUser.tokenSymbol}`
                  : undefined
              }
            />
            <CompactMetric
              label="Collections / user"
              value={collectionsPerUser(data)}
              hint={`${data.revenue.averages.perUser?.ownerCount ?? 0} paying wallets`}
            />
            <CompactMetric
              label="Potential"
              value={data.revenue.estimatedPotential.length}
              hint={formatTokenAmounts(data.revenue.estimatedPotential, 2)}
            />
            <CompactMetric label="Period transfers" value={data.revenue.periodConfirmedCount} />
          </BentoMetrics>
        </BentoRow>

        <BentoRow minHeight="min-h-[240px]">
          <BentoCell span={8}>
            <TimeSeriesChart title="Revenue trend" data={data.collections.series.daily} bento />
          </BentoCell>
          <BentoCell span={4}>
            <StatusBarChart title="By chain" data={revenueByChainChart(data)} bento />
          </BentoCell>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={4}>
            <StatusBarChart title="By token" data={revenueByTokenChart(data)} bento />
          </BentoCell>
          <BentoCell span={4}>
            <StatusBarChart
              title="Approval funnel"
              data={revenueFunnelChart(data)}
              layout="vertical"
              bento
            />
          </BentoCell>
          <BentoCell span={4}>
            <StatusBarChart title="Revenue at risk" data={revenueLossChart(data)} bento />
          </BentoCell>
        </BentoRow>
      </BentoSection>

      {/* ——— Chains ——— */}
      <BentoSection id="chains" title="Chains & tokens">
        <BentoRow>
          <BentoMetrics>
            {data.chains.slice(0, 4).map((c) => (
              <CompactMetric
                key={c.network}
                label={c.network.toUpperCase()}
                value={c.collections}
                hint={`${c.successRate}% success · ${c.wallets} wallets`}
              />
            ))}
          </BentoMetrics>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={6}>
            <StatusBarChart title="Collections by chain" data={chainCollectionsChart(data)} bento />
          </BentoCell>
          <BentoCell span={6}>
            <StatusBarChart title="Users by chain" data={chainUsersChart(data)} bento />
          </BentoCell>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={4}>
            <StatusBarChart title="Approval success" data={chainApprovalRateChart(data)} bento />
          </BentoCell>
          <BentoCell span={5}>
            <StatusBarChart
              title="Token mix per chain"
              data={tokenPerChainChart(data)}
              layout="vertical"
              bento
            />
          </BentoCell>
          <BentoCell span={3}>
            <StatusDonutChart
              title="USDT vs USDC"
              data={{
                USDT: data.tokens.usdt.collections,
                USDC: data.tokens.usdc.collections,
              }}
              bento
            />
          </BentoCell>
        </BentoRow>

        <BentoRow>
          <BentoCell span={12}>
            <BentoPanel padding="compact" className="overflow-x-auto">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Chain leaderboard</p>
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Chain</th>
                    <th className="pb-2 pr-3 font-medium">Wallets</th>
                    <th className="pb-2 pr-3 font-medium">Collections</th>
                    <th className="pb-2 pr-3 font-medium">Collected</th>
                    <th className="pb-2 pr-3 font-medium">Success</th>
                    <th className="pb-2 font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chains.map((c) => (
                    <tr key={c.network} className="border-b border-border/40">
                      <td className="py-2 pr-3 font-medium uppercase">{c.network}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.wallets}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.collections}</td>
                      <td className="py-2 pr-3">{formatTokenAmounts(c.revenue, 1)}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.successRate}%</td>
                      <td className="py-2 tabular-nums">{formatMs(c.averageCompletionTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BentoPanel>
          </BentoCell>
        </BentoRow>
      </BentoSection>

      {/* ——— Users ——— */}
      <BentoSection
        id="users"
        title="Users"
        description="Device, browser, and geo breakdowns require aggregated event telemetry — not in the current API"
      >
        <BentoRow>
          <BentoMetrics>
            <CompactMetric label="Total wallets" value={data.users.total} />
            <CompactMetric label="New (period)" value={data.users.newInPeriod} />
            <CompactMetric label="Returning" value={data.users.returningInPeriod} />
            <CompactMetric label="Active 7d" value={data.users.activeWallets} />
            <CompactMetric label="New today" value={data.users.newToday} />
            <CompactMetric label="Abandoned" value={data.users.abandonedWallets} accent="warning" />
          </BentoMetrics>
        </BentoRow>

        <BentoRow minHeight="min-h-[240px]">
          <BentoCell span={8}>
            <TimeSeriesChart title="Wallet growth" data={data.users.growthSeries} bento />
          </BentoCell>
          <BentoCell span={4}>
            <StatusBarChart title="New vs returning" data={newVsReturningChart(data)} bento />
          </BentoCell>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={6}>
            <StatusBarChart
              title="Workflow stages"
              data={userWorkflowChart(data)}
              layout="vertical"
              bento
            />
          </BentoCell>
          <BentoCell span={6}>
            <StatusDonutChart
              title="Outcome mix"
              data={{
                Completed: data.users.workflowStages.successfullyCompleted,
                Collecting: data.users.workflowStages.currentlyCollecting,
                Failed: data.users.workflowStages.failed,
              }}
              bento
            />
          </BentoCell>
        </BentoRow>
      </BentoSection>

      {/* ——— Operations ——— */}
      <BentoSection id="operations" title="Operations">
        <BentoRow>
          <BentoMetrics>
            <CompactMetric
              label="Collections"
              value={data.collections.total}
              hint={`${data.collections.successRate}% success`}
            />
            <CompactMetric
              label="Approvals"
              value={data.approvals.total}
              hint={`${data.approvals.successRate}% ok`}
            />
            <CompactMetric label="Transfers" value={data.transfers.total} />
            <CompactMetric label="Partial" value={data.collections.partial} />
            <CompactMetric label="Retries" value={data.collections.retryCollections} />
            <CompactMetric label="Failures" value={data.failures.totalFailures} accent="danger" />
          </BentoMetrics>
        </BentoRow>
        <BentoRow>
          <BentoMetrics>
            <CompactMetric label="RPC errors" value={data.failures.rpcFailures} />
            <CompactMetric label="Timeouts" value={data.failures.timeoutFailures} />
            <CompactMetric label="Avg collection" value={formatMs(data.collections.averageCollectionTimeMs)} />
            <CompactMetric label="Avg approval" value={formatMs(data.approvals.averageApprovalTimeMs)} />
            <CompactMetric label="Avg confirm" value={formatMs(data.transfers.averageConfirmationTimeMs)} />
            <CompactMetric
              label="Native funding"
              value={`${data.nativeFunding.successRate}%`}
              hint={`${data.nativeFunding.total} requests`}
            />
          </BentoMetrics>
        </BentoRow>

        <BentoRow minHeight="min-h-[240px]">
          <BentoCell span={6}>
            <TimeSeriesChart title="Daily collections" data={data.collections.series.daily} bento />
          </BentoCell>
          <BentoCell span={6}>
            <TimeSeriesChart
              title="Transfer volume"
              data={data.transfers.volumeSeries.map((d) => ({ date: d.date, count: d.count }))}
              bento
            />
          </BentoCell>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={4}>
            <StatusDonutChart title="Collection status" data={data.collections.counts} bento />
          </BentoCell>
          <BentoCell span={4}>
            <StatusDonutChart title="Approval status" data={data.approvals.counts} bento />
          </BentoCell>
          <BentoCell span={4}>
            <StatusBarChart title="Processing latency" data={latencyChart(data)} bento />
          </BentoCell>
        </BentoRow>

        <BentoRow minHeight="min-h-[220px]">
          <BentoCell span={4}>
            <StatusBarChart title="Failure categories" data={failureCategoryChart(data)} bento />
          </BentoCell>
          <BentoCell span={5}>
            <TimeSeriesChart title="Failure trend" data={data.failures.failureTrend} bento />
          </BentoCell>
          <BentoCell span={3}>
            <StatusBarChart title="By chain" data={data.failures.failureRateByChain} bento />
          </BentoCell>
        </BentoRow>

        <BentoRow>
          <BentoCell span={12}>
            <BentoPanel padding="compact">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Top failure reasons</p>
              {data.failures.topFailureReasons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No failures in this period</p>
              ) : (
                <ul className="space-y-1">
                  {data.failures.topFailureReasons.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/10 px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                      <span className="shrink-0 tabular-nums font-medium text-muted-foreground">
                        {r.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </BentoPanel>
          </BentoCell>
        </BentoRow>
      </BentoSection>

      {/* ——— Activity & health ——— */}
      <BentoSection id="activity" title="Activity & health">
        <BentoRow>
          <BentoMetrics>
            <CompactMetric label="Queue backlog" value={data.health.queueBacklog} />
            <CompactMetric label="Stuck txs" value={data.health.stuckTransactions} accent="warning" />
            <CompactMetric
              label="Collector"
              value={data.health.collectorHealth.enabled ? "On" : "Off"}
              hint={`${data.health.collectorHealth.due} due`}
            />
            <CompactMetric label="Failed wallets" value={data.health.failedWallets} />
            <CompactMetric label="Lifecycle avg" value={formatMs(data.performance.averageLifecycleMs)} />
            <CompactMetric label="RPC errors" value={data.failures.rpcFailures} />
          </BentoMetrics>
        </BentoRow>

        <BentoRow minHeight="min-h-[320px]">
          <BentoCell span={6}>
            <LiveActivityFeed className="h-full" />
          </BentoCell>
          <BentoCell span={6}>
            <BentoPanel padding="compact" className="h-full">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                Recent largest collections
              </p>
              {data.leaderboards.largestCollections.length === 0 ? (
                <p className="text-xs text-muted-foreground">No collections yet</p>
              ) : (
                <ul className="space-y-1">
                  {data.leaderboards.largestCollections.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={c.href}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/25"
                      >
                        <span className="font-medium text-primary">
                          {c.network.toUpperCase()} {c.tokenSymbol}
                        </span>
                        <span className="tabular-nums font-medium">{c.human}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </BentoPanel>
          </BentoCell>
        </BentoRow>

        <BentoRow>
          <BentoCell span={12}>
            <LeaderboardsPanel leaderboards={data.leaderboards} className="h-full" />
          </BentoCell>
        </BentoRow>

        <BentoRow>
          <BentoCell span={12}>
            <InsightsPanel insights={data.insights} />
          </BentoCell>
        </BentoRow>
      </BentoSection>

      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Operational dashboard
        </Link>
        <Link href="/pipeline" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Pipeline
        </Link>
        <Link href="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Users
        </Link>
      </div>
    </div>
  );
}
