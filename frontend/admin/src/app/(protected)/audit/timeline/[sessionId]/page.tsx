import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SessionTimelineView } from "@/components/audit/SessionTimelineView";
import { ErrorAlert } from "@/components/ErrorAlert";
import { JourneyPageHeader } from "@/components/JourneyPageHeader";
import { ListPageLayout } from "@/components/ListPageLayout";
import { Button } from "@/components/ui/button";
import { adminGetData } from "@/lib/admin-data";
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
    timeline = await adminGetData<SessionTimeline>(
      `/admin/sessions/${encodeURIComponent(decoded)}/timeline`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load timeline";
  }

  return (
    <ListPageLayout className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/audit" />}
      >
        <ChevronLeft className="size-4" />
        Back to Audit & logs
      </Button>

      <JourneyPageHeader
        transactionId={decoded}
        subtitle="Session timeline"
        walletAddress={timeline?.walletAddress}
        network={timeline?.network}
        status={timeline?.outcome ?? undefined}
      />

      {error ? (
        <ErrorAlert message={error} />
      ) : timeline ? (
        <>
          {timeline.walletAddress ? (
            <p className="text-sm">
              <Link
                href={auditTimelineLink({
                  walletAddress: timeline.walletAddress,
                })}
                className="text-primary hover:underline"
              >
                All transactions for this wallet
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
