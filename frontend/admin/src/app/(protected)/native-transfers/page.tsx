import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FilterForm } from "@/components/FilterForm";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="space-y-4">
        <PageHeader
          title="Native transfers"
          tip="User-signed native coin transfers (ETH, TRX, BNB, …) registered after broadcast. Pending rows can be reconciled manually from the detail page."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Native transfers"
          tip="User-signed native coin transfers (ETH, TRX, BNB, …) registered after broadcast. Pending rows can be reconciled manually from the detail page."
        />

      <FilterForm
        action="/native-transfers"
        values={sp}
        fields={[
          { name: "network", label: "Network" },
          { name: "owner", label: "Owner" },
          {
            name: "status",
            label: "Status",
            options: ["pending", "confirmed", "failed"],
          },
        ]}
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
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
              {data.items.map((row) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/native-transfers"
        query={sp}
      />
    </div>
  );
}
