import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { StatCard } from "@/components/StatCard";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatActivityError } from "@/components/activity/ActivityErrorCell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import { transactionDetailLink } from "@/lib/log-links";
import type { TransactionListItem } from "@/types/transaction-journey";

export type DashboardData = {
  collector: {
    enabled: boolean;
    due: number;
    leased: number;
    approvals: Record<string, number>;
    transfers: Record<string, number>;
  };
  nativeTransfers: Record<string, number>;
  recentFailures: {
    approvals: Array<{
      id: string;
      network: string;
      ownerAddress: string;
      tokenSymbol: string;
      status: string;
      lastError: string | null;
      updatedAt?: string;
    }>;
    nativeTransfers: Array<{
      id: string;
      network: string;
      ownerAddress: string;
      assetSymbol: string;
      status: string;
      errorMessage: string | null;
      updatedAt?: string;
    }>;
  };
  recentObservabilityErrors?: Array<{
    id: string;
    ts: string;
    module: string;
    operation: string;
    message: string;
    walletAddress: string | null;
    network: string | null;
    errorMessage: string | null;
    txHash: string | null;
    sessionId: string | null;
    traceId?: string | null;
  }>;
  settlement?: {
    active: number;
    recentFailed: Array<{
      id: string;
      ownerAddress: string;
      network: string;
      status: string;
      lastError: string | null;
      updatedAt: string;
      clientSessionId: string;
      traceId?: string | null;
    }>;
  };
  recentTransactions?: TransactionListItem[];
};

function sumStatuses(counts: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}

function activeApprovals(approvals: Record<string, number>): number {
  return sumStatuses(approvals, ["ACTIVE", "SUBMITTED", "PARTIALLY_USED"]);
}

function pendingTransfers(transfers: Record<string, number>): number {
  return sumStatuses(transfers, ["prepared", "broadcast", "pending"]);
}

export function DashboardOverview({ data }: { data: DashboardData }) {
  const c = data.collector;
  const failedApprovals = c.approvals.FAILED ?? 0;
  const pendingNative = data.nativeTransfers.pending ?? 0;
  const failedNative = data.nativeTransfers.failed ?? 0;
  const confirmedNative = data.nativeTransfers.confirmed ?? 0;
  const activeSettlement = data.settlement?.active ?? 0;
  const failedSettlement = data.settlement?.recentFailed?.length ?? 0;
  const attentionCount =
    c.due +
    failedApprovals +
    failedNative +
    pendingTransfers(c.transfers) +
    activeSettlement;

  const failureRows = [
    ...data.recentFailures.approvals.map((a) => ({
      id: a.id,
      kind: "Approval" as const,
      href: `/approvals/${a.id}`,
      label: `${a.network.toUpperCase()} ${a.tokenSymbol}`,
      owner: a.ownerAddress,
      status: a.status === "FAILED" ? "FAILED" : "ERROR",
      error: a.lastError,
      at: a.updatedAt,
    })),
    ...data.recentFailures.nativeTransfers.map((n) => ({
      id: n.id,
      kind: "Native" as const,
      href: `/native-transfers/${n.id}`,
      label: `${n.network.toUpperCase()} ${n.assetSymbol}`,
      owner: n.ownerAddress,
      status: n.status,
      error: n.errorMessage,
      at: n.updatedAt,
    })),
    ...(data.settlement?.recentFailed ?? []).map((s) => ({
      id: s.id,
      kind: "Settlement" as const,
      href: `/settlement-sessions/${encodeURIComponent(s.id)}`,
      journeyId: s.traceId ?? s.clientSessionId,
      label: `${s.network.toUpperCase()} settlement`,
      owner: s.ownerAddress,
      status: s.status,
      error: s.lastError,
      at: s.updatedAt,
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-6">
      {attentionCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">Items need attention</p>
              <p className="text-xs text-muted-foreground">
                {c.due} due for collection · {pendingTransfers(c.transfers)}{" "}
                transfers in-flight · {activeSettlement} settling ·{" "}
                {failedApprovals + failedNative} failed
              </p>
            </div>
          </div>
          <Link
            href="/pipeline"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open pipeline
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Due for collection"
          value={c.due}
          sub={`${c.leased} currently leased`}
          className={c.due > 0 ? "ring-1 ring-amber-500/25" : undefined}
        />
        <StatCard
          label="Active approvals"
          value={activeApprovals(c.approvals)}
          sub={`${c.approvals.COMPLETED ?? 0} completed`}
        />
        <StatCard
          label="Transfers in-flight"
          value={pendingTransfers(c.transfers)}
          sub={`${c.transfers.confirmed ?? 0} confirmed`}
        />
        <StatCard
          label="Failed approvals"
          value={failedApprovals}
          sub="Need investigation"
          className={
            failedApprovals > 0 ? "ring-1 ring-destructive/20" : undefined
          }
        />
        <StatCard
          label="Native pending"
          value={pendingNative}
          sub={`${confirmedNative} confirmed`}
        />
        <StatCard
          label="Native failed"
          value={failedNative}
          sub={c.enabled ? "Collector running" : "Collector stopped"}
          className={
            failedNative > 0 ? "ring-1 ring-destructive/20" : undefined
          }
        />
        <StatCard
          label="Settling"
          value={activeSettlement}
          sub={`${failedSettlement} recent failures`}
          className={
            activeSettlement > 0 ? "ring-1 ring-violet-500/25" : undefined
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DashboardCharts
            approvals={c.approvals}
            transfers={c.transfers}
            nativeTransfers={data.nativeTransfers}
          />
        </div>

        <Card className="border-0 xl:col-span-4">
          <CardHeader>
            <CardTitle className="font-brand text-base">
              Collector & queue
            </CardTitle>
            <CardDescription>
              Live pipeline workload and automation state
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/35 px-3 py-2.5 ring-1 ring-black/[0.03]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Collector
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {c.enabled ? "Running" : "Stopped"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/35 px-3 py-2.5 ring-1 ring-black/[0.03]">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Leased jobs
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {c.leased}
                </p>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Submitted approvals</dt>
                <dd className="font-medium tabular-nums">
                  {c.approvals.SUBMITTED ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Partially used</dt>
                <dd className="font-medium tabular-nums">
                  {c.approvals.PARTIALLY_USED ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Broadcast transfers</dt>
                <dd className="font-medium tabular-nums">
                  {c.transfers.broadcast ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Failed transfers</dt>
                <dd className="font-medium tabular-nums">
                  {c.transfers.failed ?? 0}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/pipeline"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Pipeline
              </Link>
              <Link
                href="/settings/collector"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Collector settings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {(data.recentTransactions?.length ?? 0) > 0 ? (
        <Card className="border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="font-brand text-base">
                Recent transactions
              </CardTitle>
              <CardDescription>
                Latest end-to-end user journeys by flow-* ID
              </CardDescription>
            </div>
            <Link
              href="/transactions"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Transaction ID</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Wallet</th>
                    <th className="pb-2 pr-3 font-medium">Network</th>
                    <th className="pb-2 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions?.map((row) => (
                    <tr
                      key={row.transactionId}
                      className="border-b border-border/40"
                    >
                      <td className="py-2.5 pr-3">
                        <TransactionIdLink
                          id={row.transactionId}
                          showCopy={false}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge value={row.terminalStatus} />
                      </td>
                      <td className="max-w-[140px] truncate py-2.5 pr-3 font-mono text-xs">
                        {row.walletAddress ? (
                          <Link
                            href={pipelineUserPath(row.walletAddress)}
                            className="text-primary hover:underline"
                          >
                            {row.walletAddress}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs uppercase">
                        {row.network ?? "—"}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDate(row.lastActivityAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="font-brand text-base">Recent issues</CardTitle>
          <CardDescription>
            Latest approval and native transfer failures with direct links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failureRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent failures — pipeline looks healthy.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Asset</th>
                    <th className="pb-2 pr-3 font-medium">Transaction</th>
                    <th className="pb-2 pr-3 font-medium">Wallet</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failureRows.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className="border-b border-border/40"
                    >
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {row.kind}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Link
                          href={row.href}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        {"journeyId" in row && row.journeyId ? (
                          <TransactionIdLink
                            id={row.journeyId}
                            showCopy={false}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[140px] truncate py-2.5 pr-3 font-mono text-xs">
                        <Link
                          href={pipelineUserPath(row.owner)}
                          className="text-primary hover:underline"
                        >
                          {row.owner}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge value={row.status} />
                      </td>
                      <td className="max-w-[280px] truncate py-2.5 text-xs text-destructive">
                        {formatActivityError(row.error, row.status) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.recentObservabilityErrors?.length ?? 0) > 0 ? (
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="font-brand text-base">
              Structured errors
            </CardTitle>
            <CardDescription>
              Latest observability log events at error level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentObservabilityErrors?.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-muted/35 px-4 py-3 text-sm ring-1 ring-black/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {e.module} · {e.operation}
                  </p>
                  <p className="mt-1 text-destructive">
                    {e.errorMessage ?? e.message}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {e.ts ? <span>{formatDate(e.ts)}</span> : null}
                    {e.network ? <span>{e.network.toUpperCase()}</span> : null}
                    {e.walletAddress ? (
                      <span className="font-mono">{e.walletAddress}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ViewLogsLink
                    params={{
                      walletAddress: e.walletAddress ?? undefined,
                      txHash: e.txHash ?? undefined,
                      sessionId: e.sessionId ?? undefined,
                      traceId: e.traceId ?? e.sessionId ?? undefined,
                      search: e.message,
                    }}
                  />
                  {(e.traceId ?? e.sessionId) ? (
                    <Link
                      href={transactionDetailLink(e.traceId ?? e.sessionId!)}
                      className="text-xs text-primary hover:underline"
                    >
                      Transaction journey
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/analytics"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Analytics
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/activity?tab=errors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Activity errors
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/audit?tab=structured&level=error"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Structured error logs
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
