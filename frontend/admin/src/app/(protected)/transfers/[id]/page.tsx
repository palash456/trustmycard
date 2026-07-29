import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DetailList, DetailRow } from "@/components/DetailList";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const data = await adminGetData<Detail>(`/admin/transfers/${id}`).catch(() => null);
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
              <span className="font-mono">{t.amountRaw}</span>
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
            <DetailRow label="Created">{formatDate(t.createdAt)}</DetailRow>
          </DetailList>
        </CardContent>
      </Card>
    </div>
  );
}
