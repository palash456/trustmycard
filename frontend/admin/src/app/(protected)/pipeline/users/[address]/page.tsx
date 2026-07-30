import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { UserPipelineFunnel } from "@/components/pipeline/UserPipelineFunnel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auditStructuredLink, auditTimelineLink } from "@/lib/log-links";
import { adminGetData } from "@/lib/admin-data";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import { buildUserPipelineFunnel } from "@/lib/user-pipeline-funnel";
import type { UserDetail } from "@/types/users";

export default async function UserPipelinePage({
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
    return (
      <ListPageLayout>
        <p className="text-destructive">User not found</p>
      </ListPageLayout>
    );
  }

  const s = data.summary;
  const funnelStages = buildUserPipelineFunnel(data);
  const explorerNetworks = s.networksUsed.length > 0 ? s.networksUsed : s.approvedChains;

  return (
    <ListPageLayout className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/pipeline" />}>
        <ChevronLeft className="size-4" />
        Back to pipeline
      </Button>

      <PageHeader
        title="User pipeline"
        className="items-start pb-2 md:items-start"
        description={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono text-sm font-medium">{data.address}</span>
              <CopyButton value={data.address} />
            </div>
            <p className="text-xs text-muted-foreground">
              First seen {formatDate(s.firstSeen)} · Last activity {formatDate(s.lastActivity)}
            </p>
          </>
        }
      >
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <WorkflowStageBadge value={s.workflowStage} />
            <UserHealthBadge value={s.healthStatus} />
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
          <Link
            href={`/users/${encodeURIComponent(data.address)}`}
            className="text-xs text-primary hover:underline"
          >
            Open profile →
          </Link>
          <Link
            href={auditStructuredLink({ walletAddress: data.address })}
            className="text-xs text-primary hover:underline"
          >
            Structured logs →
          </Link>
          <Link
            href={auditTimelineLink({ walletAddress: data.address })}
            className="text-xs text-primary hover:underline"
          >
            Timelines →
          </Link>
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-base">Pipeline funnel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hover each stage for live status, counts, and amounts
          </p>
        </CardHeader>
        <CardContent className="px-4 py-5 md:px-8">
          <UserPipelineFunnel stages={funnelStages} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Approvals"
          value={data.analytics.approvalCount}
          sub={`${data.analytics.failedApprovals} failed`}
        />
        <StatCard
          label="Transfers"
          value={data.analytics.transferCount}
          sub={`${data.analytics.confirmedTransfers} confirmed`}
        />
        <StatCard
          label="Native funding"
          value={data.analytics.nativeTransferCount}
          sub={`${data.analytics.confirmedNative} confirmed`}
        />
        <StatCard
          label="Success rate"
          value={`${Math.round(data.analytics.successRate)}%`}
          sub={`${data.analytics.eventCount} events tracked`}
        />
      </div>
    </ListPageLayout>
  );
}
