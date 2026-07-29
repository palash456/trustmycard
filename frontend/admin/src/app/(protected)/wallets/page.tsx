import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FilterForm } from "@/components/FilterForm";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
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

type WalletRow = {
  address: string;
  approvalCount: number;
  nativeTransferCount: number;
  eventCount: number;
  lastSeen: string | null;
};

type ListResponse = {
  items: WalletRow[];
  total: number;
  page: number;
  totalPages: number;
};

export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    search: sp.search,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/wallets${query}`);
  } catch (err) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Wallets"
          tip="Distinct owner addresses seen across approvals, native transfers, and flow events — not login accounts. Open an address for a full activity timeline."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Wallets"
          tip="Distinct owner addresses seen across approvals, native transfers, and flow events — not login accounts. Open an address for a full activity timeline."
          description="Wallet addresses with activity — not login accounts"
        />

      <FilterForm
        action="/wallets"
        values={sp}
        fields={[{ name: "search", label: "Address search" }]}
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Native</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No wallets match your search
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((row) => (
                  <TableRow key={row.address}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/wallets/${encodeURIComponent(row.address)}`}
                      className="text-primary hover:underline"
                    >
                      {shortAddress(row.address, 8, 6)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.approvalCount}</TableCell>
                  <TableCell className="tabular-nums">{row.nativeTransferCount}</TableCell>
                  <TableCell className="tabular-nums">{row.eventCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.lastSeen)}
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
        basePath="/wallets"
        query={sp}
      />
    </div>
  );
}
