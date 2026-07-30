import Link from "next/link";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import { StatusBadge } from "@/components/StatusBadge";
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
  };
};

export type NativeRow = {
  id: string;
  ownerAddress: string;
  network: string;
  assetSymbol: string;
  amountHuman: string;
  status: string;
  txHash: string;
  reconcileAttempts: number;
  createdAt: string;
};

export function ApprovalsTable({ items }: { items: ApprovalRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
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
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              No approvals found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium uppercase">{row.network}</TableCell>
              <TableCell>{row.tokenSymbol}</TableCell>
              <TableCell className="font-mono text-xs">
                <Link
                  href={pipelineUserPath(row.ownerAddress)}
                  className="text-primary hover:underline"
                >
                  {shortAddress(row.ownerAddress)}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.collectedRaw} / rem {row.remainingRaw}
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
                <ViewLogsLink params={{ walletAddress: row.ownerAddress }} />
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
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              No transfers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium uppercase">{row.approval.network}</TableCell>
              <TableCell>{row.approval.tokenSymbol}</TableCell>
              <TableCell className="font-mono text-xs">
                <Link
                  href={pipelineUserPath(row.approval.ownerAddress)}
                  className="text-primary hover:underline"
                >
                  {shortAddress(row.approval.ownerAddress)}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.amountRaw}</TableCell>
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
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              No native transfers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium uppercase">{row.network}</TableCell>
              <TableCell>{row.assetSymbol}</TableCell>
              <TableCell className="font-mono text-xs">
                <Link
                  href={pipelineUserPath(row.ownerAddress)}
                  className="text-primary hover:underline"
                >
                  {shortAddress(row.ownerAddress)}
                </Link>
              </TableCell>
              <TableCell>{row.amountHuman}</TableCell>
              <TableCell>
                <StatusBadge value={row.status} />
              </TableCell>
              <TableCell className="tabular-nums">{row.reconcileAttempts}</TableCell>
              <TableCell className="space-y-1">
                <Link
                  href={`/native-transfers/${row.id}`}
                  className="block text-sm text-primary hover:underline"
                >
                  {formatDate(row.createdAt)}
                </Link>
                <ViewLogsLink
                  params={{ walletAddress: row.ownerAddress, txHash: row.txHash }}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
