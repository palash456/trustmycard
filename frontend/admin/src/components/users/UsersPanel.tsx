"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import { InfiniteScrollFooter } from "@/components/InfiniteScrollFooter";
import { ListEmptyState } from "@/components/ListEmptyState";
import { NetworkBadge } from "@/components/NetworkBadge";
import { TokenSymbol } from "@/components/TokenSymbol";
import { WalletAddressLink } from "@/components/WalletAddressLink";
import { StatusBadge } from "@/components/StatusBadge";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfiniteScrollList } from "@/hooks/use-infinite-scroll-list";
import { buildQuery } from "@/lib/admin-api";
import { formatAdminAmount } from "@/lib/amount-display";
import { readAdminProxyError } from "@/lib/admin-proxy-client";
import { blockExplorerAddress, formatDate } from "@/lib/format";
import type {
  CollectableItem,
  CollectedTotal,
  UserListResponse,
  UserListRow,
} from "@/types/users";

const PAGE_SIZE = 30;
const AMOUNT_COLUMN_CLASS = "min-w-[720px] max-w-[720px]";

type FilterQuery = Record<string, string | undefined>;

async function fetchUsersPage(
  filters: FilterQuery,
  page: number,
): Promise<UserListResponse> {
  const qs = buildQuery({
    page: String(page),
    limit: String(PAGE_SIZE),
    search: filters.search,
    network: filters.network,
    workflowStage: filters.workflowStage,
    healthStatus: filters.healthStatus,
    approvalStatus: filters.approvalStatus,
    hasError: filters.hasError,
    sort: filters.sort,
  });
  const res = await fetch(`/api/admin/users${qs}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      await readAdminProxyError(res, `Failed to load users (${res.status})`),
    );
  }
  return (await res.json()) as UserListResponse;
}

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

function UserRow({ row }: { row: UserListRow }) {
  const userPath = `/users/${encodeURIComponent(row.publicId)}`;
  const explorer = row.activeChain
    ? blockExplorerAddress(row.activeChain, row.address)
    : row.networksUsed[0]
      ? blockExplorerAddress(row.networksUsed[0], row.address)
      : null;

  return (
    <TableRow className="[&_[data-slot=table-cell]]:py-3">
      <TableCell className="min-w-[120px]">
        <Link
          href={userPath}
          className="text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          {row.username}
        </Link>
      </TableCell>
      <TableCell className="min-w-[160px] font-mono text-xs text-muted-foreground">
        <Link href={userPath} className="hover:text-primary hover:underline">
          {row.publicId}
        </Link>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <div className="flex flex-col gap-1">
          {row.wallets.length > 0 ? (
            row.wallets.map((wallet) => (
              <WalletAddressLink
                key={`${wallet.chainType}:${wallet.address}`}
                address={wallet.address}
                head={8}
                tail={6}
                showCopy
              />
            ))
          ) : (
            <WalletAddressLink address={row.address} head={8} tail={6} showCopy />
          )}
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
}

export function UsersPanel({
  query,
  toolbar,
}: {
  query: FilterQuery;
  toolbar?: ReactNode;
}) {
  const fetchPage = useCallback(
    async (page: number) => fetchUsersPage(query, page),
    [query],
  );

  const { items, total, loadingPhase, loading, error, hasMore, sentinelRef } =
    useInfiniteScrollList({ fetchPage });

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length > 0
            ? `${items.length} of ${total}${
                hasMore && !loading ? " · scroll for more" : ""
              }${!hasMore && !loading ? " · all loaded" : ""}`
            : !loading
              ? "No users match your filters"
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LogSearchBar
            action="/users"
            className="w-80 min-w-0 gap-1 sm:w-96"
            defaultValue={query.search}
            query={query}
            placeholder="Search username, user ID, or wallet"
          />
          <Separator orientation="vertical" className="h-8" />
          {toolbar}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="min-h-0 flex-1 border-border/60 shadow-none">
        <CardContent className="h-full p-0">
          {items.length === 0 && !loading ? (
            <ListEmptyState message="No users match your filters" />
          ) : items.length === 0 && loading ? (
            <UsersTableSkeleton />
          ) : (
            <div className="h-full overflow-auto">
              <Table scrollable>
                <TableHeader>
                  <TableRow className="hover:bg-transparent [&_[data-slot=table-head]]:h-auto [&_[data-slot=table-head]]:py-3">
                    <TableHead>Username</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Wallets</TableHead>
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
                    <TableHead className={AMOUNT_COLUMN_CLASS}>
                      Collectable
                    </TableHead>
                    <TableHead className={AMOUNT_COLUMN_CLASS}>
                      Lifetime collected
                    </TableHead>
                    <TableHead>Explorer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <UserRow key={row.userId} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InfiniteScrollFooter
        sentinelRef={sentinelRef}
        loadingMore={loadingPhase === "more"}
        hasMore={hasMore}
        loading={loading}
        itemCount={items.length}
        endLabel="End of users"
      />
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="hidden h-3.5 w-32 md:block" />
        </div>
      ))}
    </div>
  );
}
