import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ReconcileButton } from "@/components/ReconcileButton";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { DetailList, DetailRow } from "@/components/DetailList";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminAmount } from "@/lib/amount-display";
import { adminGetData } from "@/lib/admin-data";
import { blockExplorerTx, formatDate, shortAddress } from "@/lib/format";

type Detail = {
  item: {
    id: string;
    idempotencyKey: string;
    amountRaw: string;
    fromAddress: string;
    toAddress: string;
    txHash: string | null;
    status: string;
    errorMessage: string | null;
    retryCount: number;
    hasSignedPayload: boolean;
    broadcastAt: string | null;
    confirmedAt: string | null;
    blockNumber: number | null;
    createdAt: string;
    approval: {
      id: string;
      network: string;
      tokenSymbol: string;
      ownerAddress: string;
    };
  };
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Detail | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<Detail>(`/admin/transfers/${id}`);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load transfer";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <Link href="/transfers" className="text-sm text-primary hover:underline">
          Back to transfers
        </Link>
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">Transfer not found</p>;
  }

  const t = data.item;
  const explorer = blockExplorerTx(t.approval.network, t.txHash);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/pipeline?tab=transfers" />}>
        <ChevronLeft className="size-4" />
        Back to pipeline
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Transfer</h1>
        <StatusBadge value={t.status} />
      </div>

      <Card className="max-w-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transfer details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label="Approval">
              <Link href={`/approvals/${t.approval.id}`} className="text-primary hover:underline">
                {t.approval.network} {t.approval.tokenSymbol}
              </Link>
            </DetailRow>
            <DetailRow label="Amount raw">
              <span className="font-mono">{formatAdminAmount(t.amountRaw)}</span>
            </DetailRow>
            <DetailRow label="From → To">
              <span className="font-mono text-xs">
                {shortAddress(t.fromAddress)} → {shortAddress(t.toAddress)}
              </span>
            </DetailRow>
            <DetailRow label="Tx hash">
              {explorer ? (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {t.txHash}
                </a>
              ) : (
                (t.txHash ?? "—")
              )}
            </DetailRow>
            <DetailRow label="Idempotency">
              <span className="font-mono text-xs">{t.idempotencyKey}</span>
            </DetailRow>
            <DetailRow label="Retries">{t.retryCount}</DetailRow>
            <DetailRow label="Signed payload">{t.hasSignedPayload ? "Yes" : "No"}</DetailRow>
            {t.errorMessage ? (
              <DetailRow label="Error">
                <span className="text-destructive">{t.errorMessage}</span>
              </DetailRow>
            ) : null}
            <DetailRow label="Broadcast">{formatDate(t.broadcastAt)}</DetailRow>
            <DetailRow label="Confirmed">{formatDate(t.confirmedAt)}</DetailRow>
            <DetailRow label="Block">{t.blockNumber ?? "—"}</DetailRow>
            <DetailRow label="Created">{formatDate(t.createdAt)}</DetailRow>
          </DetailList>
        </CardContent>
      </Card>

      {t.status === "broadcast" || t.status === "failed" ? (
        <ReconcileButton id={t.id} kind="token" />
      ) : null}

      <ViewLogsLink
        params={{
          walletAddress: t.approval.ownerAddress,
          txHash: t.txHash ?? undefined,
        }}
        label="View related structured logs"
      />
    </div>
  );
}
