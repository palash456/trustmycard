import Link from "next/link";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { NetworkBadge } from "@/components/NetworkBadge";
import { JourneyTableCell, TransactionIdMissing } from "@/components/JourneyPageHeader";
import { TokenSymbol } from "@/components/TokenSymbol";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { StatusBadge } from "@/components/StatusBadge";
import { formatAdminAmount } from "@/lib/amount-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, shortAddress } from "@/lib/format";

export type ApprovalRow = {
  id: string;
  ownerAddress: string;
  network: string;
  tokenSymbol: string;
  status: string;
  traceId?: string | null;
  collectedRaw: string;
  remainingRaw: string;
  collectionEnabled: boolean;
  nextCheckAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type TransferRow = {
  id: string;
  amountRaw: string;
  status: string;
  txHash: string | null;
  fromAddress: string;
  toAddress: string;
  createdAt: string;
  approval: {
    id: string;
    network: string;
    tokenSymbol: string;
    ownerAddress: string;
    traceId?: string | null;
  };
};

export type NativeRow = {
  id: string;
  ownerAddress: string;
  network: string;
  assetSymbol: string;
  amountHuman: string;
  status: string;
  traceId?: string | null;
  txHash: string;
  reconcileAttempts: number;
  createdAt: string;
};

export function ApprovalsTable({ items }: { items: ApprovalRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction ID</TableHead>
          <TableHead>Network</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Collected</TableHead>
          <TableHead>Next check</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="h-24 text-center text-muted-foreground"
            >
              No approvals found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <JourneyTableCell
                  transactionId={row.traceId}
                  token={row.tokenSymbol}
                  showCopy={false}
                />
              </TableCell>
              <TableCell>
                <NetworkBadge network={row.network} />
              </TableCell>
              <TableCell>
                <TokenSymbol symbol={row.tokenSymbol} />
              </TableCell>
              <TableCell>
                <WalletAddressLink
                  address={row.ownerAddress}
                  profile="pipeline"
                />
              </TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatAdminAmount(row.collectedRaw)} / rem{" "}
                {formatAdminAmount(row.remainingRaw)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(row.nextCheckAt)}
              </TableCell>
              <TableCell className="space-y-1">
                <Link
                  href={`/approvals/${row.id}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {formatDate(row.createdAt)}
                </Link>
                <ViewLogsLink
                  params={{
                    walletAddress: row.ownerAddress,
                    traceId: row.traceId ?? undefined,
                    transactionId: row.traceId ?? undefined,
                  }}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function TransfersTable({ items }: { items: TransferRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction ID</TableHead>
          <TableHead>Network</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tx</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="h-24 text-center text-muted-foreground"
            >
              No transfers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <JourneyTableCell
                  transactionId={row.approval.traceId}
                  token={row.approval.tokenSymbol}
                  showCopy={false}
                />
              </TableCell>
              <TableCell>
                <NetworkBadge network={row.approval.network} />
              </TableCell>
              <TableCell>
                <TokenSymbol symbol={row.approval.tokenSymbol} />
              </TableCell>
              <TableCell>
                <WalletAddressLink
                  address={row.approval.ownerAddress}
                  profile="pipeline"
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {formatAdminAmount(row.amountRaw)}
              </TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {row.txHash ? shortAddress(row.txHash) : "—"}
              </TableCell>
              <TableCell className="space-y-1">
                <Link
                  href={`/transfers/${row.id}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {formatDate(row.createdAt)}
                </Link>
                <ViewLogsLink
                  params={{
                    walletAddress: row.approval.ownerAddress,
                    txHash: row.txHash ?? undefined,
                    traceId: row.approval.traceId ?? undefined,
                    transactionId: row.approval.traceId ?? undefined,
                  }}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function NativeTransfersTable({ items }: { items: NativeRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction ID</TableHead>
          <TableHead>Network</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reconcile</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="h-24 text-center text-muted-foreground"
            >
              No native transfers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <JourneyTableCell
                  transactionId={row.traceId}
                  showCopy={false}
                />
              </TableCell>
              <TableCell>
                <NetworkBadge network={row.network} />
              </TableCell>
              <TableCell>
                <TokenSymbol symbol={row.assetSymbol} />
              </TableCell>
              <TableCell>
                <WalletAddressLink
                  address={row.ownerAddress}
                  profile="pipeline"
                />
              </TableCell>
              <TableCell>{row.amountHuman}</TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="tabular-nums">
                {row.reconcileAttempts}
              </TableCell>
              <TableCell className="space-y-1">
                <Link
                  href={`/native-transfers/${row.id}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {formatDate(row.createdAt)}
                </Link>
                <ViewLogsLink
                  params={{
                    walletAddress: row.ownerAddress,
                    txHash: row.txHash,
                    traceId: row.traceId ?? undefined,
                    transactionId: row.traceId ?? undefined,
                  }}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
