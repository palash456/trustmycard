import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
import { TransfersListChart } from "@/components/charts/ListPageCharts";
import { PageFilters } from "@/components/FilterForm";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JourneyTableCell } from "@/components/JourneyPageHeader";
import { formatAdminAmount } from "@/lib/amount-display";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { formatDate, shortAddress } from "@/lib/format";

type Transfer = {
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

type ListResponse = {
  items: Transfer[];
  total: number;
  page: number;
  totalPages: number;
};

const FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  { name: "owner", label: "Owner", placeholder: "Wallet address" },
  {
    name: "status",
    label: "Status",
    options: ["prepared", "broadcast", "pending", "confirmed", "failed"],
  },
] as const;

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    network: sp.network,
    owner: sp.owner,
    status: sp.status,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/transfers${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Token transfers"
          tip="Token transferFrom executions pulled by the collector or admin. Each row links to the parent approval and on-chain tx when available."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Token transfers"
        description="Collection transferFrom executions — each row links to its transaction journey (flow-* ID)"
        tip="Search by transaction ID on the Transactions page. Open a row for transfer detail and linked journey."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/transfers" values={sp} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <TransfersListChart items={data.items} />

      <ListTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tx</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No transfers found
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <JourneyTableCell transactionId={row.approval.traceId} />
                  </TableCell>
                  <TableCell className="font-medium uppercase">{row.approval.network}</TableCell>
                  <TableCell>{row.approval.tokenSymbol}</TableCell>
                  <TableCell className="font-mono text-xs">{formatAdminAmount(row.amountRaw)}</TableCell>
                  <TableCell>
                    <StatusBadge value={row.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.txHash ? shortAddress(row.txHash) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/transfers/${row.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {formatDate(row.createdAt)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListTableCard>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/transfers"
        query={sp}
      />
    </ListPageLayout>
  );
}
