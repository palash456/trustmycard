import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { TokenSymbolList } from "@/components/TokenSymbol";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { WalletAddressLink } from "@/components/WalletAddressLink";
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
import type { TransactionListResponse } from "@/types/transaction-journey";

const FILTER_FIELDS = [
  {
    name: "transactionId",
    label: "Transaction ID",
    placeholder: "flow-… or partial",
  },
  { name: "walletAddress", label: "Wallet", placeholder: "Wallet address" },
  {
    name: "network",
    label: "Network",
    options: ["eth", "bsc", "pol", "arb", "base", "tron"],
  },
  {
    name: "status",
    label: "Status",
    options: ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "IN_PROGRESS"],
  },
] as const;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const listQuery = buildQuery({
    page: sp.page ?? "1",
    limit: sp.limit ?? "25",
    search: sp.transactionId ?? sp.search,
    transactionId: sp.transactionId,
    walletAddress: sp.walletAddress,
    network: sp.network,
    status: sp.status,
  });

  let data: TransactionListResponse | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<TransactionListResponse>(
      `/admin/transactions${listQuery}`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load transactions";
  }

  if (error) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Transactions"
          description="Search and browse end-to-end user journeys by flow-* transaction ID"
        />
        <ErrorAlert message={error} />
      </ListPageLayout>
    );
  }

  const result = data ?? {
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 25,
  };

  const pageQuery = { ...sp };

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Transactions"
        description="Every flow-* ID is one user attempt from connect through settlement. Search by ID, wallet, or status."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters
            action="/transactions"
            values={pageQuery}
            fields={[...FILTER_FIELDS]}
          />
        </PageToolbar>
      </PageHeader>

      <ListTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              result.items.map((row) => (
                <TableRow key={row.transactionId}>
                  <TableCell>
                    <TransactionIdLink
                      id={row.transactionId}
                      token={
                        row.token && !row.token.includes(",")
                          ? row.token
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={row.terminalStatus} />
                  </TableCell>
                  <TableCell>
                    {row.walletAddress ? (
                      <WalletAddressLink
                        address={row.walletAddress}
                        profile="pipeline"
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <NetworkBadge network={row.network} />
                  </TableCell>
                  <TableCell>
                    <TokenSymbolList value={row.token} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(row.startedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(row.lastActivityAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {row.eventCount}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          basePath="/transactions"
          query={pageQuery}
        />
      </ListTableCard>
    </ListPageLayout>
  );
}
