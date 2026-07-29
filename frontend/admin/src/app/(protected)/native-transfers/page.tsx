import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
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
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { formatDate, shortAddress } from "@/lib/format";

type NativeTransfer = {
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

type ListResponse = {
  items: NativeTransfer[];
  total: number;
  page: number;
  totalPages: number;
};

const FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. tron" },
  { name: "owner", label: "Owner", placeholder: "Wallet address" },
  {
    name: "status",
    label: "Status",
    options: ["pending", "confirmed", "failed"],
  },
] as const;

export default async function NativeTransfersPage({
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
    data = await adminGetData<ListResponse>(`/admin/native-transfers${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Native transfers"
          tip="User-signed native coin transfers (ETH, TRX, BNB, …) registered after broadcast. Pending rows can be reconciled manually from the detail page."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Native transfers"
        tip="User-signed native coin transfers (ETH, TRX, BNB, …) registered after broadcast. Pending rows can be reconciled manually from the detail page."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/native-transfers" values={sp} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <ListTableCard>
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
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No native transfers found
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium uppercase">{row.network}</TableCell>
                  <TableCell>{row.assetSymbol}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {shortAddress(row.ownerAddress)}
                  </TableCell>
                  <TableCell>{row.amountHuman}</TableCell>
                  <TableCell>
                    <StatusBadge value={row.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">{row.reconcileAttempts}</TableCell>
                  <TableCell>
                    <Link
                      href={`/native-transfers/${row.id}`}
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
        basePath="/native-transfers"
        query={sp}
      />
    </ListPageLayout>
  );
}
