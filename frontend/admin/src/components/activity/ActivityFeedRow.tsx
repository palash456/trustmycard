import Link from "next/link";
import { ActivityErrorCell } from "@/components/activity/ActivityErrorCell";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";
import { NetworkBadge } from "@/components/NetworkBadge";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { TransactionIdMissing } from "@/components/JourneyPageHeader";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { TableCell } from "@/components/ui/table";
import { activityDetailLink } from "@/lib/log-links";
import { resolveTransactionId } from "@/lib/transaction-id";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { UnifiedActivityItem } from "@/types/activity-feed";
import { ACTIVITY_COL, ACTIVITY_ROW_CELL } from "./activity-table-columns";

function cellClass(column: keyof typeof ACTIVITY_COL, extra?: string) {
  return cn(ACTIVITY_ROW_CELL, ACTIVITY_COL[column], extra);
}

function errorPlaceholder(status: string): string {
  const key = status.toLowerCase();
  if (
    [
      "error",
      "failed",
      "failure",
      "rejected",
      "timeout",
      "cancelled",
      "canceled",
    ].includes(key)
  ) {
    return "No details";
  }
  return "No error";
}

export function ActivityFeedRow({
  row,
  showError = false,
}: {
  row: UnifiedActivityItem;
  showError?: boolean;
}) {
  const journeyId = resolveTransactionId(row);

  return (
    <>
      <TableCell className={cellClass("time", "text-xs text-muted-foreground")}>
        <span className="block truncate">{formatDate(row.at)}</span>
      </TableCell>
      <TableCell className={cellClass("transactionId")}>
        {journeyId ? (
          <TransactionIdLink id={journeyId} showCopy={false} />
        ) : (
          <TransactionIdMissing />
        )}
      </TableCell>
      <TableCell className={cellClass("user")}>
        {row.username ? (
          <Link
            href={`/users/${encodeURIComponent(row.userPublicId ?? row.userId ?? "")}`}
            className="text-xs font-medium hover:text-primary hover:underline"
          >
            {row.username}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cellClass("wallet")}>
        {row.address ? (
          <WalletAddressLink address={row.address} showCopy={false} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cellClass("network")}>
        <NetworkBadge network={row.network} />
      </TableCell>
      <TableCell className={cellClass("step", "text-sm font-medium")}>
        <span className="block truncate" title={row.step}>
          {row.step}
        </span>
      </TableCell>
      <TableCell className={cellClass("status")}>
        <ActivityStatusChip status={row.status} />
      </TableCell>
      <TableCell className={cellClass("details")}>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={row.label}
        >
          {row.label}
        </span>
      </TableCell>
      {showError ? (
        <TableCell className={cellClass("error")}>
          {row.error ? (
            <div className="truncate">
              <ActivityErrorCell error={row.error} status={row.status} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {errorPlaceholder(row.status)}
            </span>
          )}
        </TableCell>
      ) : null}
      <TableCell className={cellClass("action", "text-right")}>
        <Link
          href={activityDetailLink(row.source, row.id, {
            sessionId: row.sessionId ?? undefined,
          })}
          className="text-sm text-primary hover:underline"
        >
          View
        </Link>
      </TableCell>
    </>
  );
}
