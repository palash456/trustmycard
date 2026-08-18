import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { Card, CardContent } from "@/components/ui/card";
import {
  TRANSACTION_ID_MISSING_CLASS,
  TRANSACTION_ID_NA_LABEL,
  transactionIdColorClass,
} from "@/lib/entity-colors";
import { transactionDetailLink, transactionLogsLink } from "@/lib/log-links";
import { isMissingJourneyId, resolveTransactionId } from "@/lib/transaction-id";
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
                className={cn(
                  "break-all font-mono text-sm font-semibold hover:underline",
                  transactionIdColorClass(journeyId),
                )}
              >
                {journeyId}
              </Link>
              <CopyButton value={journeyId} />
              {status ? <StatusBadge value={status} /> : null}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={transactionDetailLink(journeyId)}
                className="text-primary hover:underline"
              >
                Open journey hub
              </Link>
              <Link
                href={transactionLogsLink(journeyId)}
                className="text-primary hover:underline"
              >
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
            No transaction ID recorded for this record — likely created before
            journey tracing was enabled.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{subtitle}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {recordLabel && recordId ? (
              <span>
                {recordLabel} <span className="font-mono">{recordId}</span>
              </span>
            ) : null}
            {walletAddress ? (
              <span>
                Wallet <WalletAddressLink address={walletAddress} />
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
export function journeyIdFromFields(fields: {
  transactionId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  clientSessionId?: string | null;
}): string | null {
  return resolveTransactionId(fields);
}

/** Placeholder when no transaction ID is recorded. */
export function TransactionIdMissing({ label = "—" }: { label?: string }) {
  return <span className={TRANSACTION_ID_MISSING_CLASS}>{label}</span>;
}

function missingTransactionIdLabel(transactionId?: string | null): string {
  const raw = transactionId?.trim();
  if (raw && isMissingJourneyId(raw)) return TRANSACTION_ID_NA_LABEL;
  return "—";
}

/** Journey table cell — full ID, per-ID color, copy icon. */
export function JourneyTableCell({
  transactionId,
  token,
  showCopy = true,
}: {
  transactionId?: string | null;
  token?: string | null;
  showCopy?: boolean;
}) {
  const id = transactionId?.trim();
  if (!id || isMissingJourneyId(id)) {
    return (
      <TransactionIdMissing label={missingTransactionIdLabel(transactionId)} />
    );
  }
  return (
    <TransactionIdLink
      id={id}
      showCopy={showCopy}
      copyVariant="icon"
      truncate={false}
      colorize
      token={token}
    />
  );
}
