import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { JourneyPageHeader } from "@/components/JourneyPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";
import { auditStructuredLink } from "@/lib/log-links";
import { formatDate } from "@/lib/format";
import { resolveTransactionId } from "@/lib/transaction-id";

type SettlementSessionDetail = {
  session: {
    id: string;
    publicId?: string | null;
    clientSessionId: string;
    ownerAddress: string;
    network: string;
    status: string;
    traceId: string | null;
    lastError: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  observability: Array<{
    id: string;
    ts: string;
    module: string;
    stage: string | null;
    status: string;
    message: string;
    traceId: string | null;
  }>;
};

export default async function SettlementSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: SettlementSessionDetail;
  try {
    data = await adminGetData<SettlementSessionDetail>(
      `/admin/settlement-sessions/${encodeURIComponent(id)}`,
    );
  } catch (err) {
    return (
      <p className="text-destructive">
        {err instanceof Error ? err.message : "Settlement session not found"}
      </p>
    );
  }

  const s = data.session;
  const transactionId = resolveTransactionId({
    traceId: s.traceId,
    clientSessionId: s.clientSessionId,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Users
      </Link>

      <JourneyPageHeader
        transactionId={transactionId}
        subtitle={`${s.network.toUpperCase()} settlement session`}
        status={s.status}
        walletAddress={s.ownerAddress}
        network={s.network}
        recordLabel="Settlement record"
        recordId={s.publicId ?? s.id}
      />

      <Card className="border-border/60 shadow-none">
        <CardContent className="grid gap-2 px-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Created </span>
            {formatDate(s.createdAt)}
          </div>
          {s.completedAt ? (
            <div>
              <span className="text-muted-foreground">Completed </span>
              {formatDate(s.completedAt)}
            </div>
          ) : null}
          {s.lastError ? (
            <div className="sm:col-span-2 text-destructive">{s.lastError}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            Observability trail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {data.observability.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
            >
              <StatusBadge value={e.status} />
              <span>{e.stage ?? e.module}</span>
              <span className="text-muted-foreground">{e.message}</span>
              <span className="ml-auto text-muted-foreground">
                {formatDate(e.ts)}
              </span>
            </div>
          ))}
          {transactionId ? (
            <Link
              href={auditStructuredLink({
                traceId: transactionId,
                transactionId,
              })}
              className="text-sm text-primary hover:underline"
            >
              View all structured logs for this transaction
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
