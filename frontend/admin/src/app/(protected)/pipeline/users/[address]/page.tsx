import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { PipelineLifecycleDashboard } from "@/components/pipeline/PipelineLifecycleDashboard";
import { PipelineLiveRefresh } from "@/components/pipeline/PipelineLiveRefresh";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auditStructuredLink, auditTimelineLink } from "@/lib/log-links";
import { adminGetData } from "@/lib/admin-data";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import type { UserPipelineSnapshot } from "@/types/pipeline";

export default async function UserPipelinePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  const encoded = encodeURIComponent(decoded);

  const pipeline = await adminGetData<UserPipelineSnapshot>(
    `/admin/users/${encoded}/pipeline`
  ).catch(() => null);

  if (!pipeline) {
    return (
      <ListPageLayout>
        <p className="text-destructive">User not found</p>
      </ListPageLayout>
    );
  }

  const { summary } = pipeline;
  const explorerNetworks =
    summary.networksUsed.length > 0 ? summary.networksUsed : summary.approvedChains;

  return (
    <ListPageLayout className="space-y-4">
      <PipelineLiveRefresh address={decoded} />
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
              <span className="break-all font-mono text-sm font-medium">{pipeline.address}</span>
              <CopyButton value={pipeline.address} />
            </div>
            <p className="text-xs text-muted-foreground">
              First seen {formatDate(summary.firstSeen)} · Last activity{" "}
              {formatDate(summary.lastActivity)}
            </p>
          </>
        }
      >
        <div className="flex flex-col items-end gap-3">
          <PageToolbar>
            <PageRefreshButton />
          </PageToolbar>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
            <WorkflowStageBadge value={summary.workflowStage} />
            <UserHealthBadge value={summary.healthStatus} />
            {summary.isComplete ? (
              <Badge
                variant="outline"
                className="border-emerald-700/30 bg-emerald-700/15 font-medium text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400"
              >
                All pipelines complete
              </Badge>
            ) : null}
            {explorerNetworks.map((network) => {
              const url = blockExplorerAddress(network, pipeline.address);
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
            href={`/users/${encoded}`}
            className="text-xs text-primary hover:underline"
          >
            Open profile →
          </Link>
          <Link
            href={auditStructuredLink({ walletAddress: pipeline.address })}
            className="text-xs text-primary hover:underline"
          >
            Structured logs →
          </Link>
          <Link
            href={auditTimelineLink({ walletAddress: pipeline.address })}
            className="text-xs text-primary hover:underline"
          >
            Timelines →
          </Link>
          </div>
        </div>
      </PageHeader>

      <PipelineLifecycleDashboard pipeline={pipeline} />
    </ListPageLayout>
  );
}
