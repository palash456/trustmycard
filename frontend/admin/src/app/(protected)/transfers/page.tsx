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
  };
};

type ListResponse = {
  items: Transfer[];
  total: number;
  page: number;
  totalPages: number;
};

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
      <div className="space-y-4">
        <PageHeader
          title="Token transfers"
          tip="Token transferFrom executions pulled by the collector or admin. Each row links to the parent approval and on-chain tx when available."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Token transfers"
          tip="Token transferFrom executions pulled by the collector or admin. Each row links to the parent approval and on-chain tx when available."
        />

      <FilterForm
        action="/transfers"
        values={sp}
        fields={[
          { name: "network", label: "Network" },
          { name: "owner", label: "Owner" },
          {
            name: "status",
            label: "Status",
            options: ["prepared", "broadcast", "pending", "confirmed", "failed"],
          },
        ]}
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Network</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tx</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium uppercase">
                    {row.approval.network}
                  </TableCell>
                  <TableCell>{row.approval.tokenSymbol}</TableCell>
                  <TableCell className="font-mono text-xs">{row.amountRaw}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/transfers"
        query={sp}
      />
    </div>
  );
}
