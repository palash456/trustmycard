import { ActivityFeedRow } from "@/components/activity/ActivityFeedRow";
import { ActivityRefreshClient } from "@/components/activity/ActivityRefreshClient";
import {
  ACTIVITY_COL,
  ACTIVITY_HEAD_CELL,
} from "@/components/activity/activity-table-columns";
import { ActivityOverviewSection } from "@/components/activity/ActivityOverviewSection";
import { ActivityQuickFilters } from "@/components/activity/ActivityQuickFilters";
import { ActivityTabsNav, type ActivityTab } from "@/components/activity/ActivityTabsNav";
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
import { cn } from "@/lib/utils";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import type { ActivityFeedResponse } from "@/types/activity-feed";

const FILTER_FIELDS = [
  {
    name: "network",
    label: "Network",
    options: ["eth", "bsc", "pol", "arb", "base", "tron"],
  },
  { name: "address", label: "Wallet", placeholder: "Wallet address" },
  { name: "type", label: "Step", placeholder: "scan, approve, PREPARE" },
  {
    name: "status",
    label: "Status",
    options: ["success", "in_progress", "error", "failed", "failure", "rejected"],
  },
  { name: "search", label: "Search", placeholder: "Message or tx hash" },
  { name: "transactionId", label: "Transaction ID", placeholder: "flow-…" },
  { name: "from", label: "From", placeholder: "YYYY-MM-DD" },
  { name: "to", label: "To", placeholder: "YYYY-MM-DD" },
] as const;

function headClass(column: keyof typeof ACTIVITY_COL, extra?: string) {
  return cn(ACTIVITY_HEAD_CELL, ACTIVITY_COL[column], extra);
}

function parseTab(value: string | undefined): ActivityTab {
  if (
    value === "connections" ||
    value === "flow" ||
    value === "user" ||
    value === "errors" ||
    value === "sessions"
  ) {
    return value;
  }
  return "all";
}

/** Sum of fixed column widths — keeps header/body aligned while scrolling. */
const TABLE_MIN_WIDTH = Object.values(ACTIVITY_COL).reduce((sum, col) => {
  const match = col.match(/w-\[(\d+)px\]/);
  return sum + (match ? Number(match[1]) : 0);
}, 0);

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const activityQuery = { ...sp, tab: tab === "all" ? undefined : tab };

  const transactionId = sp.transactionId?.trim() || sp.traceId?.trim() || undefined;

  const feedQuery = buildQuery({
    page: sp.page ?? "1",
    limit: sp.limit ?? "25",
    tab: tab === "all" ? undefined : tab,
    network: sp.network,
    address: sp.address,
    type: sp.type,
    status: sp.status,
    search: sp.search,
    traceId: transactionId,
    transactionId,
    from: sp.from,
    to: sp.to,
  });

  let feedData: ActivityFeedResponse | null = null;
  let error: string | null = null;

  try {
    feedData = await adminGetData<ActivityFeedResponse>(
      `/admin/activity/feed${feedQuery}`
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load";
  }

  if (error) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Activity"
          description="Real wallet journeys from QR scan through payment"
        />
        <ErrorAlert message={error} />
      </ListPageLayout>
    );
  }

  const data = feedData ?? {
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 25,
  };

  const showErrorCol = tab === "errors" || tab === "all" || tab === "flow";
  const tableMinWidth = showErrorCol
    ? TABLE_MIN_WIDTH
    : TABLE_MIN_WIDTH - 220;

  return (
    <ListPageLayout className="space-y-4">
      <ActivityRefreshClient />
      <PageHeader
        title="Activity"
        description="Real user journeys only — connect, scan, authorize, and pay. Internal and test logs live under Audit."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/activity" values={activityQuery} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <ActivityOverviewSection tab={tab} total={data.total} items={data.items} />

      <ActivityTabsNav activeTab={tab} query={activityQuery} />

      <ActivityQuickFilters query={activityQuery} />

      <ListTableCard>
        <Table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={headClass("time")}>Time</TableHead>
              <TableHead className={headClass("transactionId")}>Transaction ID</TableHead>
              <TableHead className={headClass("wallet")}>Wallet</TableHead>
              <TableHead className={headClass("network")}>Network</TableHead>
              <TableHead className={headClass("step")}>Step</TableHead>
              <TableHead className={headClass("status")}>Status</TableHead>
              <TableHead className={headClass("details")}>Details</TableHead>
              {showErrorCol ? (
                <TableHead className={headClass("error")}>Error</TableHead>
              ) : null}
              <TableHead className={headClass("action", "text-right")}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showErrorCol ? 9 : 8}
                  className="h-24 px-5 text-center text-muted-foreground"
                >
                  No user journey activity found
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <ActivityFeedRow row={row} showError={showErrorCol} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          basePath="/activity"
          query={activityQuery}
        />
      </ListTableCard>
    </ListPageLayout>
  );
}
