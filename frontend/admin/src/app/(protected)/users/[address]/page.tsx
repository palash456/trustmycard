import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { DetailList, DetailRow } from "@/components/DetailList";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { UserBalancesPanel } from "@/components/UserBalancesPanel";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditStructuredLink, auditTimelineLink } from "@/lib/log-links";
import { adminGetData } from "@/lib/admin-data";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import type { UserDetail } from "@/types/users";

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
  approval: { id: string; network: string; tokenSymbol: string };
};

type NativeRow = {
  id: string;
  network: string;
  assetSymbol: string;
  amountHuman: string;
  status: string;
  reconcileAttempts: number;
  errorMessage: string | null;
  txHash: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  type: string;
  network: string;
  status: string;
  error: string | null;
  ip: string | null;
  location: string | null;
  device: string | null;
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
  const data = await adminGetData<UserDetail>(
    `/admin/users/${encodeURIComponent(decoded)}`
  ).catch(() => null);

  if (!data) {
    return <p className="text-destructive">User not found</p>;
  }

  const s = data.summary;
  const approvals = data.approvalHistory as ApprovalRow[];
  const transfers = data.transfers as TransferRow[];
  const nativeTransfers = data.nativeTransfers as NativeRow[];
  const events = data.events as EventRow[];
  const resources = data.resourceSponsorships as ResourceRow[];
  const observabilityEvents = (data.observabilityEvents ?? []) as Array<{
    id: string;
    ts: string;
    module: string;
    operation: string;
    status: string;
    level: string | null;
    message: string;
    errorMessage: string | null;
  }>;
  const auditLogs = (data.auditLogs ?? []) as Array<{
    id: string;
    action: string;
    actor: string;
    createdAt: string;
    payload: unknown;
  }>;
  const recentTimeline = data.timeline.slice(0, 8);

  const explorerNetworks = s.networksUsed.length > 0 ? s.networksUsed : s.approvedChains;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/users" />}>
        <ChevronLeft className="size-4" />
        Back to users
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all font-mono text-lg font-semibold tracking-tight">
              {data.address}
            </h1>
            <CopyButton value={data.address} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WorkflowStageBadge value={s.workflowStage} />
            <UserHealthBadge value={s.healthStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            First seen {formatDate(s.firstSeen)} · Last activity {formatDate(s.lastActivity)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={pipelineUserPath(data.address)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            View pipeline funnel
          </Link>
          <Link
            href={auditStructuredLink({ walletAddress: data.address })}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
          >
            Structured logs
          </Link>
          <Link
            href={auditTimelineLink({ walletAddress: data.address })}
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
          <TabsTrigger value="approvals">Approvals ({approvals.length})</TabsTrigger>
          <TabsTrigger value="transfers">Transfers ({transfers.length})</TabsTrigger>
          <TabsTrigger value="native">Native ({nativeTransfers.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({data.timeline.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({events.length})</TabsTrigger>
          <TabsTrigger value="logs">
            Logs ({observabilityEvents.length + auditLogs.length})
          </TabsTrigger>
          <TabsTrigger value="errors">Errors ({data.errors.length})</TabsTrigger>
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
                  {s.approvalStatus ? <StatusBadge value={s.approvalStatus} /> : "—"}
                </DetailRow>
                <DetailRow label="Collection">{s.collectionStatus ?? "—"}</DetailRow>
                <DetailRow label="Transfer">
                  {s.transferStatus ? <StatusBadge value={s.transferStatus} /> : "—"}
                </DetailRow>
                <DetailRow label="Native funding">
                  {s.nativeFundingStatus ? (
                    <StatusBadge value={s.nativeFundingStatus} />
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Reconciliation">{s.reconciliationStatus ?? "—"}</DetailRow>
                {s.latestError ? (
                  <DetailRow label="Latest error">
                    <span className="text-destructive">{s.latestError}</span>
                  </DetailRow>
                ) : null}
              </DetailList>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Active approvals</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {(data.activeApprovals as ApprovalRow[]).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No active approvals</p>
              ) : (
                (data.activeApprovals as ApprovalRow[]).map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/approvals/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.network} {a.tokenSymbol}
                    </Link>
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-muted-foreground">
                      {a.amountHuman} · collected {a.collectedRaw} · rem {a.remainingRaw}
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
                  <div key={`${item.type}-${item.id}`} className="px-4 py-3 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                    <p className="font-medium">{item.label}</p>
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
                    <p className="text-xs text-muted-foreground">{formatDate(r.at)}</p>
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
                <DetailRow label="Active chain">{s.activeChain ?? "—"}</DetailRow>
                <DetailRow label="Approved chains">
                  {s.approvedChains.length > 0 ? s.approvedChains.join(", ") : "—"}
                </DetailRow>
                <DetailRow label="Networks used">
                  {s.networksUsed.length > 0 ? s.networksUsed.join(", ") : "—"}
                </DetailRow>
                <DetailRow label="Lifetime collected">
                  {s.lifetimeCollected.length > 0
                    ? s.lifetimeCollected
                        .map(
                          (i) =>
                            `${i.collectedHuman ?? i.collectedRaw} ${i.tokenSymbol} (${i.network})`
                        )
                        .join(", ")
                    : "—"}
                </DetailRow>
                <DetailRow label="Collectable remaining">
                  {s.collectableRemaining.length > 0
                    ? s.collectableRemaining
                        .map(
                          (i) =>
                            `${i.remainingHuman ?? i.remainingRaw} ${i.tokenSymbol} (${i.network})`
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
                <CardTitle className="text-base">Resource sponsorships</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {resources.map((r) => (
                  <div key={r.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">
                      {r.network} {r.resource} · {r.provider}
                    </p>
                    <StatusBadge value={r.status} />
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(r.expiresAt)} · {formatDate(r.createdAt)}
                    </p>
                    {r.errorMessage ? (
                      <p className="text-xs text-destructive">{r.errorMessage}</p>
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
                <p className="p-6 text-sm text-muted-foreground">No approval history</p>
              ) : (
                approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
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
                      <span className="text-xs text-destructive">{a.lastError}</span>
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
                <p className="p-6 text-sm text-muted-foreground">No transfer history</p>
              ) : (
                transfers.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/transfers/${t.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.approval.network} {t.approval.tokenSymbol} · {t.amountRaw}
                    </Link>
                    <StatusBadge value={t.status} />
                    {t.retryCount > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t.retryCount} retries
                      </span>
                    ) : null}
                    {t.errorMessage ? (
                      <span className="text-xs text-destructive">{t.errorMessage}</span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="native" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {nativeTransfers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No native transfers</p>
              ) : (
                nativeTransfers.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
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

        <TabsContent value="timeline" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.timeline.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No timeline events</p>
              ) : (
                data.timeline.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="px-4 py-3 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                    <p className="font-medium">{item.label}</p>
                    <StatusBadge value={item.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {events.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No activity events</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/activity/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {e.type} · {e.network}
                      </Link>
                      <StatusBadge value={e.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.createdAt)}
                      {e.ip ? ` · ${e.ip}` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                      {e.device ? ` · ${e.device}` : ""}
                    </p>
                    {e.error ? (
                      <p className="text-xs text-destructive">{e.error}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={auditStructuredLink({ walletAddress: data.address })} className="text-primary hover:underline">
              All structured logs →
            </Link>
            <Link href={auditTimelineLink({ walletAddress: data.address })} className="text-primary hover:underline">
              Session timelines →
            </Link>
          </div>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Structured observability events</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {observabilityEvents.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No structured logs yet</p>
              ) : (
                observabilityEvents.map((e) => (
                  <div key={e.id} className="px-4 py-3 text-sm">
                    <p className="text-xs text-muted-foreground">{formatDate(e.ts)}</p>
                    <p className="font-medium">
                      {e.module}/{e.operation}: {e.message}
                    </p>
                    {e.errorMessage ? (
                      <p className="text-xs text-destructive">{e.errorMessage}</p>
                    ) : null}
                    <StatusBadge value={e.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {auditLogs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No audit entries</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 text-sm">
                    <p>
                      {formatDate(log.createdAt)} · {log.action} · {log.actor}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.errors.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No errors recorded</p>
              ) : (
                data.errors.map((e) => (
                  <div key={`${e.source}-${e.id}`} className="px-4 py-3 text-sm">
                    <p className="font-medium text-destructive">{e.message}</p>
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
            <StatCard label="Activity events" value={events.length} />
            <StatCard
              label="Timeline entries"
              value={data.timeline.length}
              sub="Full lifecycle history"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
