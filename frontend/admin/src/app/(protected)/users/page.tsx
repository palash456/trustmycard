import Link from "next/link";
import { ExternalLink, Receipt } from "lucide-react";
import { NetworkBadge } from "@/components/NetworkBadge";
import { TokenSymbol } from "@/components/TokenSymbol";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { formatAdminAmount } from "@/lib/amount-display";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import type {
  CollectableItem,
  CollectedTotal,
  UserListResponse,
} from "@/types/users";

const AMOUNT_COLUMN_CLASS = "min-w-[720px] max-w-[720px]";

function TokenAmountRow({
  amount,
  tokenSymbol,
  network,
}: {
  amount: string;
  tokenSymbol: string;
  network: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span className="tabular-nums text-foreground">{amount}</span>
      <TokenSymbol symbol={tokenSymbol} className="text-xs" />
      <NetworkBadge network={network} />
    </span>
  );
}

function CollectableAmounts({ items }: { items: CollectableItem[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${AMOUNT_COLUMN_CLASS}`}
    >
      {items.map((item, index) => (
        <span
          key={`${item.network}-${item.tokenSymbol}`}
          className="inline-flex items-center gap-2"
        >
          {index > 0 ? (
            <span className="text-muted-foreground/40">·</span>
          ) : null}
          <TokenAmountRow
            amount={formatAdminAmount(item.remainingHuman ?? item.remainingRaw)}
            tokenSymbol={item.tokenSymbol}
            network={item.network}
          />
        </span>
      ))}
    </span>
  );
}

function CollectedAmounts({ items }: { items: CollectedTotal[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${AMOUNT_COLUMN_CLASS}`}
    >
      {items.map((item, index) => (
        <span
          key={`${item.network}-${item.tokenSymbol}`}
          className="inline-flex items-center gap-2"
        >
          {index > 0 ? (
            <span className="text-muted-foreground/40">·</span>
          ) : null}
          <TokenAmountRow
            amount={formatAdminAmount(item.collectedHuman ?? item.collectedRaw)}
            tokenSymbol={item.tokenSymbol}
            network={item.network}
          />
        </span>
      ))}
    </span>
  );
}

function NetworkBadgeList({ networks }: { networks: string[] }) {
  if (networks.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex max-w-[140px] flex-wrap gap-1">
      {networks.map((network) => (
        <NetworkBadge key={network} network={network} />
      ))}
    </span>
  );
}

const FILTER_FIELDS = [
  {
    name: "search",
    label: "Address search",
    placeholder: "Full or partial address",
  },
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  {
    name: "workflowStage",
    label: "Workflow",
    options: [
      "idle",
      "connected",
      "approving",
      "approved",
      "collecting",
      "completed",
      "native_pending",
      "failed",
    ],
  },
  {
    name: "healthStatus",
    label: "Health",
    options: ["healthy", "warning", "error", "idle"],
  },
  {
    name: "approvalStatus",
    label: "Approval status",
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
  { name: "hasError", label: "Has error", options: ["true"] },
  {
    name: "sort",
    label: "Sort",
    options: [
      "lastActivity:desc",
      "lastActivity:asc",
      "firstSeen:desc",
      "approvalCount:desc",
      "transferCount:desc",
    ],
  },
] as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    limit: sp.limit ?? "25",
    search: sp.search,
    network: sp.network,
    workflowStage: sp.workflowStage,
    healthStatus: sp.healthStatus,
    approvalStatus: sp.approvalStatus,
    hasError: sp.hasError,
    sort: sp.sort,
  });

  let data: UserListResponse;
  try {
    data = await adminGetData<UserListResponse>(`/admin/users${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Users"
          tip="Each wallet is a user profile. Use Transactions to search by flow-* journey ID across all wallets."
        />
        <ErrorAlert
          message={err instanceof Error ? err.message : "Failed to load"}
        />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout
      fill
      className="h-[calc(100dvh-18rem)] max-h-[calc(100dvh-18rem)]"
    >
      <PageHeader
        className="shrink-0"
        title="Users"
        description="Wallet addresses grouped by activity — open a user or browse their transaction journeys"
        tip="Each wallet is a user profile. Use Transactions to search by flow-* journey ID across all wallets."
      >
        <PageToolbar>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-primary hover:bg-muted"
          >
            <Receipt className="size-3.5" />
            All transactions
          </Link>
          <PageRefreshButton />
          <PageFilters
            action="/users"
            values={sp}
            fields={[...FILTER_FIELDS]}
          />
        </PageToolbar>
      </PageHeader>

      <ListTableCard scrollable>
        <Table scrollable>
          <TableHeader>
            <TableRow className="hover:bg-transparent [&_[data-slot=table-head]]:h-auto [&_[data-slot=table-head]]:py-3">
              <TableHead>Address</TableHead>
              <TableHead>First seen</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Active chain</TableHead>
              <TableHead>Approved chains</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Transfer</TableHead>
              <TableHead>Native</TableHead>
              <TableHead className={AMOUNT_COLUMN_CLASS}>Collectable</TableHead>
              <TableHead className={AMOUNT_COLUMN_CLASS}>
                Lifetime collected
              </TableHead>
              <TableHead>Explorer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users match your filters
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => {
                const explorer = row.activeChain
                  ? blockExplorerAddress(row.activeChain, row.address)
                  : row.networksUsed[0]
                    ? blockExplorerAddress(row.networksUsed[0], row.address)
                    : null;
                return (
                  <TableRow
                    key={row.address}
                    className="[&_[data-slot=table-cell]]:py-3"
                  >
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <WalletAddressLink
                          address={row.address}
                          head={8}
                          tail={6}
                          showCopy
                        />
                        <Link
                          href={`/transactions?walletAddress=${encodeURIComponent(row.address)}`}
                          className="text-[10px] text-primary hover:underline"
                          title="View transaction journeys"
                        >
                          journeys
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.firstSeen)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.lastActivity)}
                    </TableCell>
                    <TableCell>
                      <WorkflowStageBadge value={row.workflowStage} />
                    </TableCell>
                    <TableCell>
                      <UserHealthBadge value={row.healthStatus} />
                    </TableCell>
                    <TableCell>
                      <NetworkBadge network={row.activeChain} />
                    </TableCell>
                    <TableCell>
                      <NetworkBadgeList networks={row.approvedChains} />
                    </TableCell>
                    <TableCell>
                      {row.approvalStatus ? (
                        <StatusBadge value={row.approvalStatus} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[100px] truncate text-xs">
                      {row.collectionStatus ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.transferStatus ? (
                        <StatusBadge value={row.transferStatus} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.nativeFundingStatus ? (
                        <StatusBadge value={row.nativeFundingStatus} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={AMOUNT_COLUMN_CLASS}>
                      <CollectableAmounts items={row.collectableRemaining} />
                    </TableCell>
                    <TableCell className={AMOUNT_COLUMN_CLASS}>
                      <CollectedAmounts items={row.totalLifetimeCollected} />
                    </TableCell>
                    <TableCell>
                      {explorer ? (
                        <a
                          href={explorer}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-primary hover:underline"
                          title="Open in block explorer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ListTableCard>

      <div className="shrink-0">
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          basePath="/users"
          query={sp}
        />
      </div>
    </ListPageLayout>
  );
}
