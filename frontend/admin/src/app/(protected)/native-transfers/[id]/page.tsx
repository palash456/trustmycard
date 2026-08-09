import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { ErrorAlert } from "@/components/ErrorAlert";
import { DetailList, DetailRow } from "@/components/DetailList";
import { JourneyPageHeader } from "@/components/JourneyPageHeader";
import { ReconcileButton } from "@/components/ReconcileButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";
import { formatAdminAmount } from "@/lib/amount-display";
import { blockExplorerTx, formatDate } from "@/lib/format";

type Detail = {
  item: {
    id: string;
    publicId?: string | null;
    ownerAddress: string;
    toAddress: string;
    network: string;
    assetSymbol: string;
    amountRaw: string;
    amountHuman: string;
    expectedAmountRaw: string | null;
    feeHuman: string | null;
    txHash: string;
    status: string;
    errorMessage: string | null;
    reconcileAttempts: number;
    lastReconcileAt: string | null;
    confirmedAt: string | null;
    createdAt: string;
    traceId: string | null;
  };
};

export default async function NativeTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Detail | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<Detail>(`/admin/native-transfers/${id}`);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load native transfer";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <Link href="/native-transfers" className="text-sm text-primary hover:underline">
          Back to native transfers
        </Link>
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">Native transfer not found</p>;
  }

  const n = data.item;
  const explorer = blockExplorerTx(n.network, n.txHash);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/pipeline?tab=native" />}
      >
        <ChevronLeft className="size-4" />
        Back to pipeline
      </Button>

      <JourneyPageHeader
        transactionId={n.traceId}
        subtitle={`${n.network.toUpperCase()} ${n.assetSymbol} native transfer`}
        status={n.status}
        walletAddress={n.ownerAddress}
        network={n.network}
        recordLabel="Native transfer record"
        recordId={n.publicId ?? n.id}
      />

      {n.status === "pending" ? <ReconcileButton id={n.id} /> : null}

      <Card className="max-w-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Native transfer details</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label="Owner">
              <span className="font-mono text-xs">{n.ownerAddress}</span>
            </DetailRow>
            <DetailRow label="To">
              <span className="font-mono text-xs">{n.toAddress}</span>
            </DetailRow>
            <DetailRow label="Amount">
              {formatAdminAmount(n.amountHuman)} ({formatAdminAmount(n.amountRaw)} raw)
            </DetailRow>
            <DetailRow label="Expected raw">{formatAdminAmount(n.expectedAmountRaw)}</DetailRow>
            <DetailRow label="Fee">{n.feeHuman ?? "—"}</DetailRow>
            <DetailRow label="Tx hash">
              {explorer ? (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {n.txHash}
                </a>
              ) : (
                n.txHash
              )}
            </DetailRow>
            <DetailRow label="Reconcile attempts">{n.reconcileAttempts}</DetailRow>
            <DetailRow label="Last reconcile">{formatDate(n.lastReconcileAt)}</DetailRow>
            <DetailRow label="Confirmed">{formatDate(n.confirmedAt)}</DetailRow>
            {n.errorMessage ? (
              <DetailRow label="Error">
                <span className="text-destructive">{n.errorMessage}</span>
              </DetailRow>
            ) : null}
          </DetailList>
        </CardContent>
      </Card>

      <ViewLogsLink
        params={{
          walletAddress: n.ownerAddress,
          txHash: n.txHash,
          traceId: n.traceId ?? undefined,
        }}
        label="View structured logs"
      />
    </div>
  );
}
