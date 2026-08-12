import { WalletAddressLink } from "@/components/WalletAddressLink";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { formatDate } from "@/lib/format";

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

const FILTER_FIELDS = [
  {
    name: "search",
    label: "Address search",
    placeholder: "Full or partial address",
  },
] as const;

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
      <ListPageLayout>
        <PageHeader
          title="Wallets"
          tip="Distinct owner addresses seen across approvals, native transfers, and flow events — not login accounts. Open an address for a full activity timeline."
        />
        <ErrorAlert
          message={err instanceof Error ? err.message : "Failed to load"}
        />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Wallets"
        description="Legacy wallet list — use Users and Transactions for journey-centric views"
        tip="Prefer the Users page for profiles and Transactions for flow-* journey IDs. This list remains for backward compatibility."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters
            action="/wallets"
            values={sp}
            fields={[...FILTER_FIELDS]}
          />
        </PageToolbar>
      </PageHeader>

      <ListTableCard>
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
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No wallets match your search
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={row.address}>
                  <TableCell>
                    <WalletAddressLink
                      address={row.address}
                      head={8}
                      tail={6}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.approvalCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.nativeTransferCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.eventCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.lastSeen)}
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
        basePath="/wallets"
        query={sp}
      />
    </ListPageLayout>
  );
}
