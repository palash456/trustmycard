import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { Card, CardContent } from "@/components/ui/card";
import { transactionDetailLink, transactionLogsLink } from "@/lib/log-links";
import { resolveTransactionId } from "@/lib/transaction-id";
import { cn } from "@/lib/utils";

export function JourneyPageHeader({
  transactionId,
  subtitle,
  status,
  walletAddress,
  network,
  recordLabel,
  recordId,
  className,
}: {
  transactionId?: string | null;
  subtitle: string;
  status?: string;
  walletAddress?: string | null;
  network?: string | null;
  recordLabel?: string;
  recordId?: string;
  className?: string;
}) {
  const journeyId = transactionId?.trim() || null;

  return (
    <div className={cn("space-y-3", className)}>
      {journeyId ? (
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="space-y-2 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Transaction ID
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={transactionDetailLink(journeyId)}
                className="break-all font-mono text-sm font-semibold text-primary hover:underline"
              >
                {journeyId}
              </Link>
              <CopyButton value={journeyId} />
              {status ? <StatusBadge value={status} /> : null}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link href={transactionDetailLink(journeyId)} className="text-primary hover:underline">
                Open journey hub
              </Link>
              <Link href={transactionLogsLink(journeyId)} className="text-primary hover:underline">
                Structured logs
              </Link>
              <Link
                href={`/activity?transactionId=${encodeURIComponent(journeyId)}`}
                className="text-primary hover:underline"
              >
                Activity feed
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
          <CardContent className="px-4 py-3 text-sm text-muted-foreground">
            No transaction ID recorded for this record — likely created before journey tracing was enabled.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{subtitle}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {recordLabel && recordId ? (
              <span>
                {recordLabel}{" "}
                <span className="font-mono">{recordId}</span>
              </span>
            ) : null}
            {walletAddress ? (
              <span>
                Wallet{" "}
                <Link
                  href={`/users/${encodeURIComponent(walletAddress)}`}
                  className="font-mono text-primary hover:underline"
                >
                  {walletAddress}
                </Link>
              </span>
            ) : null}
            {network ? <span className="uppercase">{network}</span> : null}
          </div>
        </div>
        {!journeyId && status ? <StatusBadge value={status} /> : null}
      </div>
    </div>
  );
}

/** Resolve journey ID from common entity field shapes. */
export function journeyIdFromFields(
  fields: {
    transactionId?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    clientSessionId?: string | null;
  }
): string | null {
  return resolveTransactionId(fields);
}

/** Compact journey cell for tables — full ID in title, truncated link in cell. */
export function JourneyTableCell({
  transactionId,
}: {
  transactionId?: string | null;
}) {
  const id = transactionId?.trim();
  if (!id) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return <TransactionIdLink id={id} showCopy={false} />;
}
