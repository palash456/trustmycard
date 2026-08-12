import { formatActivityError } from "@/components/activity/ActivityErrorCell";
import { formatPipelineErrorMessage } from "@/lib/format-pipeline-error";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Receipt } from "lucide-react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CopyButton } from "@/components/CopyButton";
import { WalletAddressText } from "@/components/WalletAddressLink";
import { DetailList, DetailRow } from "@/components/DetailList";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { UserBalancesPanel } from "@/components/UserBalancesPanel";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserActivityFeedList } from "@/components/activity/UserActivityFeedList";
import { SettlementSessionsPanel } from "@/components/SettlementSessionsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activityLink } from "@/lib/log-links";
import { resolveTransactionId } from "@/lib/transaction-id";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { adminGetData } from "@/lib/admin-data";
import { formatAdminAmount } from "@/lib/amount-display";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import type { UserDetail } from "@/types/users";
import type { UnifiedActivityItem } from "@/types/activity-feed";

type ApprovalRow = {
  id: string;
  network: string;
  tokenSymbol: string;
  status: string;
  amountHuman: string;
  remainingRaw: string;
  collectedRaw: string;
  collectionEnabled: boolean;
  lastError: string | null;
  failureCount: number;
  traceId?: string | null;
  txHash: string;
  createdAt: string;
};

type TransferRow = {
  id: string;
  amountRaw: string;
  status: string;
  txHash: string | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  approval: {
    id: string;
    network: string;
    tokenSymbol: string;
    traceId?: string | null;
  };
};

type NativeRow = {
  id: string;
  network: string;
  assetSymbol: string;
  amountHuman: string;
  status: string;
  reconcileAttempts: number;
  errorMessage: string | null;
  traceId?: string | null;
  txHash: string;
  createdAt: string;
};

type ResourceRow = {
  id: string;
  network: string;
  resource: string;
  status: string;
  provider: string;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  let data: UserDetail | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<UserDetail>(
      `/admin/users/${encodeURIComponent(decoded)}`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load user";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          render={<Link href="/users" />}
        >
          <ChevronLeft className="size-4" />
          Back to users
        </Button>
        <ErrorAlert message={error} />
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">User not found</p>;
  }

  const s = data.summary;
  const approvals = data.approvalHistory as ApprovalRow[];
  const activeApprovals = (data.activeApprovals as ApprovalRow[]) ?? [];
  const revokedApprovals = (data.revokedApprovals as ApprovalRow[]) ?? [];
  const transfers = data.transfers as TransferRow[];
  const nativeTransfers = data.nativeTransfers as NativeRow[];
  const resources = data.resourceSponsorships as ResourceRow[];
  const activityFeed = (data.activityFeed ?? []) as UnifiedActivityItem[];
  const activityFeedTotal = data.activityFeedTotal ?? activityFeed.length;
  const recentTimeline = activityFeed.slice(0, 8);
  const settlementSessions = data.settlementSessions ?? [];

  const explorerNetworks =
    s.networksUsed.length > 0 ? s.networksUsed : s.approvedChains;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/users" />}
      >
        <ChevronLeft className="size-4" />
        Back to users
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              <WalletAddressText
                address={data.address}
                className="text-lg font-semibold"
              />
            </h1>
            <CopyButton value={data.address} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WorkflowStageBadge value={s.workflowStage} />
            <UserHealthBadge value={s.healthStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            First seen {formatDate(s.firstSeen)} · Last activity{" "}
            {formatDate(s.lastActivity)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/transactions?walletAddress=${encodeURIComponent(data.address)}`}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Receipt className="size-3" />
            Transaction journeys
          </Link>
          <Link
            href={pipelineUserPath(data.address)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            View pipeline funnel
          </Link>
          <Link
            href={activityLink({ address: data.address, tab: "all" })}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            All activity logs
          </Link>
          <Link
            href={activityLink({ address: data.address, tab: "errors" })}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            Error logs
          </Link>
          <Link
            href={activityLink({ address: data.address, tab: "sessions" })}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            Session timelines
          </Link>
          {explorerNetworks.map((network) => {
            const url = blockExplorerAddress(network, data.address);
            if (!url) return null;
            return (
              <a
                key={network}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
              >
                {network.toUpperCase()}
                <ExternalLink className="size-3" />
              </a>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="transfers">
            Transfers ({transfers.length})
          </TabsTrigger>
          <TabsTrigger value="native">
            Native ({nativeTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="settlement">
            Settlement ({settlementSessions.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline ({activityFeedTotal})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({activityFeedTotal})
          </TabsTrigger>
          <TabsTrigger value="logs">Logs ({activityFeedTotal})</TabsTrigger>
          <TabsTrigger value="errors">
            Errors ({data.errors.length})
          </TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Success rate"
              value={`${data.analytics.successRate}%`}
              sub={`${data.analytics.confirmedTransfers} transfers · ${data.analytics.confirmedNative} native confirmed`}
            />
            <StatCard
              label="Health"
              value={s.healthStatus}
              sub={`Workflow: ${s.workflowStage.replace("_", " ")}`}
            />
            <StatCard
              label="Approvals"
              value={data.analytics.approvalCount}
              sub={`${data.analytics.failedApprovals} failed`}
            />
            <StatCard
              label="Transfers"
              value={data.analytics.transferCount}
              sub={`${data.analytics.failedTransfers} failed`}
            />
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Pipeline status</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="Approval">
                  {s.approvalStatus ? (
                    <StatusBadge value={s.approvalStatus} />
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Collection">
                  {s.collectionStatus ?? "—"}
                </DetailRow>
                <DetailRow label="Transfer">
                  {s.transferStatus ? (
                    <StatusBadge value={s.transferStatus} />
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Native funding">
                  {s.nativeFundingStatus ? (
                    <StatusBadge value={s.nativeFundingStatus} />
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Reconciliation">
                  {s.reconciliationStatus ?? "—"}
                </DetailRow>
                {settlementSessions[0] ? (
                  <DetailRow label="Background settlement">
                    <span className="text-sm">
                      {settlementSessions[0].statusLabel}
                    </span>
                  </DetailRow>
                ) : null}
                {s.latestError ? (
                  <DetailRow label="Latest error">
                    <span className="text-destructive">
                      {formatPipelineErrorMessage(s.latestError)}
                    </span>
                  </DetailRow>
                ) : null}
              </DetailList>
            </CardContent>
          </Card>

          {recentTimeline.some((i) => i.transactionId ?? i.traceId) ||
          settlementSessions.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Recent transaction journeys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {settlementSessions.slice(0, 5).map((session) => {
                  const journeyId = resolveTransactionId({
                    traceId: session.traceId,
                    clientSessionId: session.clientSessionId,
                  });
                  if (!journeyId) return null;
                  return (
                    <div
                      key={session.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <StatusBadge value={session.status} />
                      <TransactionIdLink id={journeyId} />
                      <span className="text-xs text-muted-foreground">
                        {session.network}
                      </span>
                    </div>
                  );
                })}
                {recentTimeline
                  .filter((i) => i.transactionId ?? i.traceId)
                  .slice(0, 5)
                  .map((item) => {
                    const journeyId = resolveTransactionId(item);
                    if (!journeyId) return null;
                    return (
                      <div
                        key={`${item.source}-${item.id}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-xs text-muted-foreground">
                          {item.step}
                        </span>
                        <TransactionIdLink id={journeyId} />
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Active approvals</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {activeApprovals.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No active approvals
                </p>
              ) : (
                activeApprovals.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    {a.traceId ? (
                      <TransactionIdLink id={a.traceId} showCopy={false} />
                    ) : null}
                    <Link
                      href={`/approvals/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.network} {a.tokenSymbol}
                    </Link>
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatAdminAmount(a.amountHuman)} · collected{" "}
                      {formatAdminAmount(a.collectedRaw)} · rem{" "}
                      {formatAdminAmount(a.remainingRaw)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Revoked approvals</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {revokedApprovals.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No revoked approvals
                </p>
              ) : (
                revokedApprovals.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    {a.traceId ? (
                      <TransactionIdLink id={a.traceId} showCopy={false} />
                    ) : null}
                    <Link
                      href={`/approvals/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.network} {a.tokenSymbol}
                    </Link>
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatAdminAmount(a.amountHuman)} · collected{" "}
                      {formatAdminAmount(a.collectedRaw)} · rem{" "}
                      {formatAdminAmount(a.remainingRaw)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {recentTimeline.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {recentTimeline.map((item) => (
                  <div
                    key={`${item.source}-${item.id}`}
                    className="px-4 py-3 text-sm"
                  >
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.at)}
                    </p>
                    <p className="font-medium">{item.step ?? item.label}</p>
                    <StatusBadge value={item.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data.retryHistory.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Retry history</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {data.retryHistory.map((r) => (
                  <div key={`${r.type}-${r.id}`} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      {r.type} · {r.count} attempt{r.count !== 1 ? "s" : ""}
                    </p>
                    {r.lastError ? (
                      <p className="text-xs text-destructive">{r.lastError}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          <UserBalancesPanel address={data.address} />
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Wallet information</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label="Active chain">
                  {s.activeChain ?? "—"}
                </DetailRow>
                <DetailRow label="Approved chains">
                  {s.approvedChains.length > 0
                    ? s.approvedChains.join(", ")
                    : "—"}
                </DetailRow>
                <DetailRow label="Networks used">
                  {s.networksUsed.length > 0 ? s.networksUsed.join(", ") : "—"}
                </DetailRow>
                <DetailRow label="Lifetime collected">
                  {s.lifetimeCollected.length > 0
                    ? s.lifetimeCollected
                        .map(
                          (i) =>
                            `${formatAdminAmount(i.collectedHuman ?? i.collectedRaw)} ${i.tokenSymbol} (${i.network})`,
                        )
                        .join(", ")
                    : "—"}
                </DetailRow>
                <DetailRow label="Collectable remaining">
                  {s.collectableRemaining.length > 0
                    ? s.collectableRemaining
                        .map(
                          (i) =>
                            `${formatAdminAmount(i.remainingHuman ?? i.remainingRaw)} ${i.tokenSymbol} (${i.network})`,
                        )
                        .join(", ")
                    : "—"}
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>
          {resources.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  Resource sponsorships
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {resources.map((r) => (
                  <div key={r.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      {r.network} {r.resource} · {r.provider}
                    </p>
                    <StatusBadge value={r.status} />
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(r.expiresAt)} ·{" "}
                      {formatDate(r.createdAt)}
                    </p>
                    {r.errorMessage ? (
                      <p className="text-xs text-destructive">
                        {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {approvals.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No approval history
                </p>
              ) : (
                approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    {a.traceId ? (
                      <TransactionIdLink id={a.traceId} showCopy={false} />
                    ) : null}
                    <Link
                      href={`/approvals/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.network} {a.tokenSymbol}
                    </Link>
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.createdAt)} · {a.amountHuman}
                    </span>
                    {a.lastError ? (
                      <span className="text-xs text-destructive">
                        {a.lastError}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {transfers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No transfer history
                </p>
              ) : (
                transfers.map((t) => {
                  const journeyId = resolveTransactionId({
                    traceId: t.approval.traceId,
                  });
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                    >
                      {journeyId ? (
                        <TransactionIdLink id={journeyId} showCopy={false} />
                      ) : null}
                      <Link
                        href={`/transfers/${t.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t.approval.network} {t.approval.tokenSymbol} ·{" "}
                        {formatAdminAmount(t.amountRaw)}
                      </Link>
                      <StatusBadge value={t.status} />
                      {t.retryCount > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t.retryCount} retries
                        </span>
                      ) : null}
                      {t.errorMessage ? (
                        <span className="text-xs text-destructive">
                          {t.errorMessage}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="native" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {nativeTransfers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No native transfers
                </p>
              ) : (
                nativeTransfers.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    {n.traceId ? (
                      <TransactionIdLink id={n.traceId} showCopy={false} />
                    ) : null}
                    <Link
                      href={`/native-transfers/${n.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {n.network} {n.assetSymbol} · {n.amountHuman}
                    </Link>
                    <StatusBadge value={n.status} />
                    {n.reconcileAttempts > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {n.reconcileAttempts} reconcile attempts
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <SettlementSessionsPanel
            sessions={settlementSessions}
            walletAddress={data.address}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              <UserActivityFeedList
                items={activityFeed}
                walletAddress={data.address}
                emptyMessage="No timeline events"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              <UserActivityFeedList
                items={activityFeed}
                walletAddress={data.address}
                emptyMessage="No activity events"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Unified activity log</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              <UserActivityFeedList
                items={activityFeed}
                walletAddress={data.address}
                emptyMessage="No logs yet"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.errors.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No errors recorded
                </p>
              ) : (
                data.errors.map((e) => (
                  <div
                    key={`${e.source}-${e.id}`}
                    className="px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-destructive">
                      {formatActivityError(e.message, "error") ??
                        "Unknown error"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.source} · {formatDate(e.at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Success rate"
              value={`${data.analytics.successRate}%`}
              sub="Across transfers and native funding"
            />
            <StatCard
              label="Total approvals"
              value={data.analytics.approvalCount}
              sub={`${data.analytics.failedApprovals} failed`}
            />
            <StatCard
              label="Total transfers"
              value={data.analytics.transferCount}
              sub={`${data.analytics.confirmedTransfers} confirmed · ${data.analytics.failedTransfers} failed`}
            />
            <StatCard
              label="Native transfers"
              value={data.analytics.nativeTransferCount}
              sub={`${data.analytics.confirmedNative} confirmed · ${data.analytics.failedNative} failed`}
            />
            <StatCard label="Activity logs" value={activityFeedTotal} />
            <StatCard
              label="Unified log entries"
              value={activityFeedTotal}
              sub="Structured, flow, audit, and entity events"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
