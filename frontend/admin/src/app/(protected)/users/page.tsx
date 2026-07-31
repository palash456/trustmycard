import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
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
import { blockExplorerAddress, formatDate, shortAddress } from "@/lib/format";
import type { UserListResponse } from "@/types/users";

function formatCollectable(
  items: UserListResponse["items"][0]["collectableRemaining"]
): string {
  if (items.length === 0) return "—";
  return items
    .map(
      (i) =>
        `${formatAdminAmount(i.remainingHuman ?? i.remainingRaw)} ${i.tokenSymbol} (${i.network})`
    )
    .join(", ");
}

function formatCollected(
  items: UserListResponse["items"][0]["totalLifetimeCollected"]
): string {
  if (items.length === 0) return "—";
  return items
    .map(
      (i) =>
        `${formatAdminAmount(i.collectedHuman ?? i.collectedRaw)} ${i.tokenSymbol} (${i.network})`
    )
    .join(", ");
}

const FILTER_FIELDS = [
  { name: "search", label: "Address search", placeholder: "Full or partial address" },
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
          tip="Each wallet address is treated as a user. This view aggregates the full transaction lifecycle — approvals, collections, native transfers, events, and errors — in one place."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
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
        description="Each wallet address is a user — search by full or partial address to investigate the complete lifecycle"
        tip="Each wallet address is treated as a user. This view aggregates the full transaction lifecycle — approvals, collections, native transfers, events, and errors — in one place."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/users" values={sp} fields={[...FILTER_FIELDS]} />
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
              <TableHead>Reconcile</TableHead>
              <TableHead>Collectable</TableHead>
              <TableHead>Lifetime collected</TableHead>
              <TableHead>Counts</TableHead>
              <TableHead>Latest error</TableHead>
              <TableHead>Explorer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">
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
                  <TableRow key={row.address} className="[&_[data-slot=table-cell]]:py-5">
                    <TableCell className="min-w-[140px] font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/users/${encodeURIComponent(row.address)}`}
                          className="text-primary hover:underline"
                        >
                          {shortAddress(row.address, 8, 6)}
                        </Link>
                        <CopyButton value={row.address} label="Copy" />
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
                    <TableCell className="uppercase">{row.activeChain ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs uppercase">
                      {row.approvedChains.join(", ") || "—"}
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
                    <TableCell className="text-xs">{row.reconciliationStatus ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">
                      {formatCollectable(row.collectableRemaining)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">
                      {formatCollected(row.totalLifetimeCollected)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      A{row.approvalCount} T{row.transferCount} N{row.nativeTransferCount} E
                      {row.eventCount}
                    </TableCell>
                    <TableCell className="max-w-[120px] text-xs text-muted-foreground">
                      {row.latestError ? (
                        <span className="truncate text-destructive">{row.latestError}</span>
                      ) : (
                        "No error"
                      )}
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
        <Pagination page={data.page} totalPages={data.totalPages} basePath="/users" query={sp} />
      </div>
    </ListPageLayout>
  );
}
