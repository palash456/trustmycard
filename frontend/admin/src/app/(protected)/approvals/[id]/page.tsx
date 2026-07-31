import Link from "next/link";
import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import { ChevronLeft } from "lucide-react";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { ApprovalControls } from "@/components/ApprovalControls";
import { ManualTransferForm } from "@/components/ManualTransferForm";
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
    ownerAddress: string;
    spenderAddress: string;
    network: string;
    tokenSymbol: string;
    status: string;
    amountHuman: string;
    remainingRaw: string;
    collectedRaw: string;
    unlimited: boolean;
    collectionEnabled: boolean;
    collectionToAddress: string | null;
    nextCheckAt: string | null;
    lastError: string | null;
    failureCount: number;
    decimals: number;
    txHash: string;
    createdAt: string;
  };
  transfers: Array<{
    id: string;
    amountRaw: string;
    status: string;
    txHash: string | null;
    createdAt: string;
  }>;
  audits: Array<{
    id: string;
    action: string;
    actor: string;
    createdAt: string;
    payload?: unknown;
  }>;
  collectionIntents: Array<{
    id: string;
    status: string;
    requestedRaw: string;
    settledRaw: string;
    retryCount: number;
    lastErrorMessage: string | null;
    createdAt: string;
    attempts: Array<{ id: string; sequence: number; status: string; txHash: string | null }>;
  }>;
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Detail;
  try {
    data = await adminGetData<Detail>(`/admin/approvals/${id}`);
  } catch (err) {
    return (
      <p className="text-destructive">
        {err instanceof Error ? err.message : "Not found"}
      </p>
    );
  }

  const a = data.item;
  const explorer = blockExplorerTx(a.network, a.txHash);
  const confirmAudit = data.audits.find((log) => log.action === "confirm");
  const confirmPayload = (confirmAudit?.payload ?? {}) as {
    transferSkippedReason?: string;
    collectionPolicy?: string;
    zeroBalanceAtConfirm?: boolean;
    tokenBalanceHuman?: string | null;
  };
  const collectionNote = confirmPayload.transferSkippedReason
    ? formatTransferSkipReason(confirmPayload.transferSkippedReason)
    : confirmPayload.collectionPolicy === "zero_balance_collect_later"
      ? formatTransferSkipReason("zero_balance_collect_later")
      : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/pipeline?tab=approvals" />}>
        <ChevronLeft className="size-4" />
        Back to pipeline
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {a.network.toUpperCase()} {a.tokenSymbol}
        </h1>
        <StatusBadge value={a.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Approval details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Owner">
                <span className="font-mono text-xs">{a.ownerAddress}</span>
              </DetailRow>
              <DetailRow label="Spender">
                <span className="font-mono text-xs">{a.spenderAddress}</span>
              </DetailRow>
              <DetailRow label="Amount">{a.amountHuman}</DetailRow>
              <DetailRow label="Collected / remaining">
                {formatAdminAmount(a.collectedRaw)} / {formatAdminAmount(a.remainingRaw)}
              </DetailRow>
              <DetailRow label="Collection">
                {a.collectionEnabled ? "Enabled" : "Disabled"}
              </DetailRow>
              {collectionNote ? (
                <DetailRow label="Collection note">
                  <span className="text-muted-foreground">{collectionNote}</span>
                </DetailRow>
              ) : null}
              {confirmPayload.zeroBalanceAtConfirm ? (
                <DetailRow label="Balance at authorize">
                  {confirmPayload.tokenBalanceHuman ?? "0"} (zero — waiting for deposit)
                </DetailRow>
              ) : null}
              <DetailRow label="Next check">{formatDate(a.nextCheckAt)}</DetailRow>
              {a.lastError ? (
                <DetailRow label="Last error">
                  <span className="text-destructive">{a.lastError}</span>
                </DetailRow>
              ) : null}
              <DetailRow label="Approve tx">
                {explorer ? (
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {shortAddress(a.txHash, 10, 8)}
                  </a>
                ) : (
                  shortAddress(a.txHash, 10, 8)
                )}
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>

        {(a.status === "ACTIVE" || a.status === "PARTIALLY_USED") && (
          <ManualTransferForm
            approvalId={a.id}
            defaultToAddress={a.collectionToAddress || a.spenderAddress}
            decimals={a.decimals}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ViewLogsLink
          params={{ walletAddress: a.ownerAddress, txHash: a.txHash }}
          label="View structured logs"
        />
      </div>

      <ApprovalControls
        approvalId={a.id}
        collectionEnabled={a.collectionEnabled}
        collectionToAddress={a.collectionToAddress}
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {data.transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfers yet</p>
          ) : (
            <ul className="divide-y">
              {data.transfers.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <Link href={`/transfers/${t.id}`} className="text-primary hover:underline">
                    {formatAdminAmount(t.amountRaw)} raw
                  </Link>
                  <StatusBadge value={t.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Collection intents</CardTitle>
        </CardHeader>
        <CardContent>
          {data.collectionIntents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No event-driven collection intent exists for this approval.</p>
          ) : (
            <ul className="space-y-3">
              {data.collectionIntents.map((intent) => (
                <li key={intent.id} className="rounded-md border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{shortAddress(intent.id)}</span>
                    <StatusBadge value={intent.status} />
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Requested {intent.requestedRaw} · settled {intent.settledRaw} · retries {intent.retryCount}
                  </p>
                  {intent.lastErrorMessage ? <p className="mt-1 text-destructive">{intent.lastErrorMessage}</p> : null}
                  {intent.attempts.map((attempt) => (
                    <p key={attempt.id} className="mt-1 font-mono text-xs text-muted-foreground">
                      Attempt {attempt.sequence}: {attempt.status} {attempt.txHash ? `· ${shortAddress(attempt.txHash)}` : ""}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {data.audits.map((log) => (
              <li key={log.id} className="rounded-md border border-border/60 p-3">
                <p>
                  {formatDate(log.createdAt)} · {log.action} · {log.actor}
                </p>
                {log.payload ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/20 p-2 font-mono text-xs">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
