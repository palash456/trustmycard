import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SessionTimelineView } from "@/components/audit/SessionTimelineView";
import { JourneyPageHeader } from "@/components/JourneyPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { JourneyEntitySections } from "@/components/transactions/JourneyEntitySections";
import { TransactionPipelinePanel } from "@/components/transactions/TransactionPipelinePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";
import {
  auditStructuredLink,
  auditTimelineLink,
  transactionLogsLink,
} from "@/lib/log-links";
import { formatDate, shortAddress } from "@/lib/format";
import type { TransactionJourneyDetail } from "@/types/transaction-journey";

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { transactionId } = await params;
  const sp = await searchParams;
  const selectedToken = sp.token?.trim() || null;
  let data: TransactionJourneyDetail;
  try {
    data = await adminGetData<TransactionJourneyDetail>(
      `/admin/transactions/${encodeURIComponent(transactionId)}`,
    );
  } catch (err) {
    return (
      <p className="text-destructive">
        {err instanceof Error ? err.message : "Transaction not found"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ButtonBack />

      <JourneyPageHeader
        transactionId={data.transactionId}
        subtitle="Transaction journey hub"
        status={data.terminalStatus ?? undefined}
        walletAddress={data.walletAddress}
        network={data.network}
      />

      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">Context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4 pb-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Wallet </span>
            {data.walletAddress ? (
              <Link
                href={`/users/${encodeURIComponent(data.walletAddress)}`}
                className="font-mono text-primary hover:underline"
              >
                {shortAddress(data.walletAddress)}
              </Link>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Network </span>
            {data.network ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Token </span>
            {data.token ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Started </span>
            {data.startedAt ? formatDate(data.startedAt) : "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Completed </span>
            {data.completedAt ? formatDate(data.completedAt) : "—"}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">Navigation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 px-4 pb-4 text-sm">
          {data.walletAddress ? (
            <>
              <Link
                href={`/pipeline/users/${encodeURIComponent(data.walletAddress)}`}
                className="text-primary hover:underline"
              >
                Pipeline funnel
              </Link>
              <Link
                href={`/users/${encodeURIComponent(data.walletAddress)}`}
                className="text-primary hover:underline"
              >
                User profile
              </Link>
            </>
          ) : null}
          <Link
            href={transactionLogsLink(data.transactionId)}
            className="text-primary hover:underline"
          >
            Structured logs
          </Link>
          <Link
            href={auditTimelineLink({ sessionId: data.transactionId })}
            className="text-primary hover:underline"
          >
            Session timeline
          </Link>
          <Link
            href={`/activity?transactionId=${encodeURIComponent(data.transactionId)}`}
            className="text-primary hover:underline"
          >
            Activity feed
          </Link>
        </CardContent>
      </Card>

      {data.timeline ? <SessionTimelineView timeline={data.timeline} /> : null}

      {data.pipeline ? (
        <TransactionPipelinePanel
          pipeline={data.pipeline}
          transactionId={data.transactionId}
          journey={data}
          selectedToken={selectedToken}
        />
      ) : null}

      <JourneyEntitySections data={data} network={data.network} />

      {data.settlementSessions.length > 0 ? (
        <Card className="border-border/60 shadow-none">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">
              Settlement sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 text-sm">
            {data.settlementSessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
              >
                <StatusBadge value={s.status} />
                <Link
                  href={`/settlement-sessions/${encodeURIComponent(s.id)}`}
                  className="text-xs text-primary hover:underline"
                >
                  Settlement record
                </Link>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {s.id}
                </span>
                <span className="text-muted-foreground">{s.network}</span>
                {s.completedAt ? (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(s.completedAt)}
                  </span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            Observability trail ({data.observabilityEvents.length} events)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {data.observabilityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No structured events recorded for this transaction.
            </p>
          ) : (
            data.observabilityEvents.slice(-30).map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={e.status} />
                  <span className="font-medium">{e.module}</span>
                  <span className="text-muted-foreground">
                    {e.stage ?? e.operation}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {formatDate(e.ts)}
                  </span>
                </div>
                {e.message ? (
                  <p className="text-muted-foreground">{e.message}</p>
                ) : null}
                {e.txHash ? (
                  <p className="font-mono text-muted-foreground">
                    tx {e.txHash}
                  </p>
                ) : null}
              </div>
            ))
          )}
          <Link
            href={auditStructuredLink({
              traceId: data.transactionId,
              transactionId: data.transactionId,
            })}
            className="text-sm text-primary hover:underline"
          >
            View all structured logs
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ButtonBack() {
  return (
    <Link href="/transactions">
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Transactions
      </span>
    </Link>
  );
}
