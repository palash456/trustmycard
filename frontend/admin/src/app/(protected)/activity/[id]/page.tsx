import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActivityErrorCell } from "@/components/activity/ActivityErrorCell";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";
import { CopyButton } from "@/components/CopyButton";
import { DetailList, DetailRow } from "@/components/DetailList";
import { ErrorAlert } from "@/components/ErrorAlert";
import { JourneyPageHeader } from "@/components/JourneyPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";
import { activityLink } from "@/lib/log-links";
import { resolveTransactionId } from "@/lib/transaction-id";
import { formatDate } from "@/lib/format";
import type {
  ActivityFeedSource,
  UnifiedActivityItem,
} from "@/types/activity-feed";

type DetailResponse = {
  source: ActivityFeedSource;
  summary: UnifiedActivityItem;
  item: Record<string, unknown>;
  nodes?: Array<Record<string, unknown>>;
};

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const source = (sp.source ?? "tg") as ActivityFeedSource;

  let data: DetailResponse | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<DetailResponse>(
      `/admin/activity/feed/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    );
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load activity event";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <Link href="/activity" className="text-sm text-primary hover:underline">
          Back to activity
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Activity event not found</p>
        <Link href="/activity" className="text-sm text-primary hover:underline">
          Back to activity
        </Link>
      </div>
    );
  }

  const e = data.summary;
  const journeyId = resolveTransactionId(e);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/activity" />}
      >
        <ChevronLeft className="size-4" />
        Back to activity
      </Button>

      <JourneyPageHeader
        transactionId={journeyId}
        subtitle={e.label}
        status={e.status}
        walletAddress={e.address}
        network={e.network}
        recordLabel="Activity event"
        recordId={`${e.source}:${e.id}`}
      />

      <Card className="max-w-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Step details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label="Step">{e.step}</DetailRow>
            <DetailRow label="Status">
              <ActivityStatusChip status={e.status} />
            </DetailRow>
            <DetailRow label="Time">{formatDate(e.at)}</DetailRow>
            <DetailRow label="Wallet">
              <span className="font-mono text-xs">{e.address}</span>
              <CopyButton value={e.address} />
            </DetailRow>
            {e.network ? (
              <DetailRow label="Network">{e.network.toUpperCase()}</DetailRow>
            ) : null}
            {e.txHash ? (
              <DetailRow label="Tx hash">
                <span className="break-all font-mono text-xs">{e.txHash}</span>
                <CopyButton value={e.txHash} />
              </DetailRow>
            ) : null}
            {e.error ? (
              <DetailRow label="Error">
                <ActivityErrorCell error={e.error} status={e.status} />
              </DetailRow>
            ) : null}
          </DetailList>

          <Link
            href={`/users/${encodeURIComponent(e.address)}`}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Open user profile →
          </Link>
          {journeyId ? (
            <div className="mt-2">
              <Link
                href={activityLink({
                  transactionId: journeyId,
                  traceId: journeyId,
                })}
                className="text-sm text-primary hover:underline"
              >
                All steps for this transaction →
              </Link>
            </div>
          ) : (
            <div className="mt-2">
              <Link
                href={activityLink({ address: e.address })}
                className="text-sm text-primary hover:underline"
              >
                All activity for this wallet →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {data.nodes && data.nodes.length > 0 ? (
        <Card className="max-w-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Session steps</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {data.nodes.map((node) => {
              const stage =
                typeof node.stage === "string" ? node.stage : "step";
              const message =
                typeof node.message === "string" ? node.message : stage;
              const status =
                typeof node.status === "string" ? node.status : "unknown";
              const ts = typeof node.ts === "string" ? node.ts : null;
              const errorMessage =
                typeof node.errorMessage === "string"
                  ? node.errorMessage
                  : null;
              return (
                <div key={String(node.id)} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{stage}</span>
                    <ActivityStatusChip status={status} />
                    {ts ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(ts)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground">{message}</p>
                  {errorMessage ? (
                    <p className="text-xs text-destructive">{errorMessage}</p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
