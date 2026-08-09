import Link from "next/link";
import { ActivityErrorCell } from "@/components/activity/ActivityErrorCell";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { activityDetailLink, activityLink } from "@/lib/log-links";
import { resolveTransactionId } from "@/lib/transaction-id";
import { formatDate } from "@/lib/format";
import type { UnifiedActivityItem } from "@/types/activity-feed";

export function UserActivityFeedList({
  items,
  walletAddress,
  emptyMessage = "No journey activity yet",
}: {
  items: UnifiedActivityItem[];
  walletAddress: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      {items.map((item) => {
        const journeyId = resolveTransactionId(item);
        return (
          <div key={`${item.source}-${item.id}`} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-muted-foreground">
                {formatDate(item.at)}
              </span>
              {journeyId ? (
                <TransactionIdLink id={journeyId} showCopy={false} />
              ) : null}
              <span className="font-medium">{item.step}</span>
              <ActivityStatusChip status={item.status} />
              {item.network ? (
                <span className="text-xs uppercase text-muted-foreground">
                  {item.network}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-muted-foreground">{item.label}</p>
            {item.error ? (
              <div className="mt-1">
                <ActivityErrorCell error={item.error} status={item.status} />
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href={activityDetailLink(item.source, item.id, {
                  sessionId: item.sessionId ?? undefined,
                })}
                className="text-xs text-primary hover:underline"
              >
                View details
              </Link>
            </div>
          </div>
        );
      })}
      <div className="border-t px-4 py-3">
        <Link
          href={activityLink({ address: walletAddress })}
          className="text-sm text-primary hover:underline"
        >
          View full journey in Activity →
        </Link>
      </div>
    </>
  );
}
