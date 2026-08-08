import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SessionTimelineView } from "@/components/audit/SessionTimelineView";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { adminGetLogData } from "@/lib/admin-data";
import { auditTimelineLink } from "@/lib/log-links";
import type { SessionTimeline } from "@/lib/observability";

export default async function AuditTimelineDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const decoded = decodeURIComponent(sessionId);

  let timeline: SessionTimeline | null = null;
  let error: string | null = null;
  try {
    timeline = await adminGetLogData<SessionTimeline>(
      `/admin/sessions/${encodeURIComponent(decoded)}/timeline`
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load timeline";
  }

  return (
    <ListPageLayout className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/audit?tab=timelines" />}>
        <ChevronLeft className="size-4" />
        Back to timelines
      </Button>

      <PageHeader
        title="Session timeline"
        description={decoded}
        tip="Hierarchical authorization journey reconstructed from observability events."
      />

      {error ? (
        <ErrorAlert message={error} />
      ) : timeline ? (
        <>
          {timeline.walletAddress ? (
            <p className="text-sm">
              <Link
                href={auditTimelineLink({ walletAddress: timeline.walletAddress })}
                className="text-primary hover:underline"
              >
                All timelines for this wallet
              </Link>
            </p>
          ) : null}
          <SessionTimelineView timeline={timeline} />
        </>
      ) : (
        <ErrorAlert message="Timeline not found" />
      )}
    </ListPageLayout>
  );
}
