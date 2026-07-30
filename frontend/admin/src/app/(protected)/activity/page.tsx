import Link from "next/link";
import { EventsListChart } from "@/components/charts/ListPageCharts";
import { ActivityErrorCell } from "@/components/activity/ActivityErrorCell";
import { ActivityOverviewSection } from "@/components/activity/ActivityOverviewSection";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";
import { ActivityTabsNav, type ActivityTab } from "@/components/activity/ActivityTabsNav";
import { SessionTimelineListRow } from "@/components/audit/SessionTimelineView";
import { ViewLogsLink } from "@/components/audit/ViewLogsLink";
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
import type { ObservabilityEventRow, PaginatedResponse } from "@/lib/observability";
import { formatDate, shortAddress } from "@/lib/format";

type TgEvent = {
  id: string;
  type: string;
  network: string;
  address: string;
  status: string;
  error: unknown;
  ip: string | null;
  location: string | null;
  createdAt: string;
};

type ListResponse = {
  items: TgEvent[];
  total: number;
  page: number;
  totalPages: number;
};

const FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  { name: "address", label: "Address", placeholder: "Wallet address" },
  { name: "type", label: "Type", placeholder: "connect, approve, scan" },
  { name: "status", label: "Status", placeholder: "success, error" },
] as const;

function parseTab(value: string | undefined): ActivityTab {
  if (
    value === "user" ||
    value === "errors" ||
    value === "sessions" ||
    value === "connections"
  ) {
    return value;
  }
  return "flow";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const activityQuery = { ...sp, tab: tab === "flow" ? undefined : tab };

  const commonQuery = buildQuery({
    page: sp.page ?? "1",
    network: sp.network,
    address: sp.address,
    type: sp.type,
    status: sp.status,
    tab: tab === "flow" ? undefined : tab,
  });

  let tgData: ListResponse | null = null;
  let timelineData: PaginatedResponse<ObservabilityEventRow> | null = null;
  let error: string | null = null;

  try {
    if (tab === "sessions") {
      timelineData = await adminGetData<PaginatedResponse<ObservabilityEventRow>>(
        `/admin/observability/events${buildQuery({
          page: sp.page ?? "1",
          tab: "timelines",
          walletAddress: sp.address,
          network: sp.network,
        })}`
      );
    } else {
      tgData = await adminGetData<ListResponse>(`/admin/tg-events${commonQuery}`);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load";
  }

  if (error) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Activity"
          description="Operational monitoring — understand what happened across flows, users, and sessions"
          tip="User and system telemetry from the wallet flow. For structured logs and admin actions, use Audit & logs."
        />
        <ErrorAlert message={error} />
      </ListPageLayout>
    );
  }

  const data = tgData ?? {
    items: [],
    total: timelineData?.total ?? 0,
    page: timelineData?.page ?? 1,
    totalPages: timelineData?.totalPages ?? 1,
  };

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Activity"
        description="Wallet flow telemetry — connections, approvals, scans, and errors"
        tip="Filter by wallet, network, or type. For structured backend logs and admin actions, use Audit & logs."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/activity" values={activityQuery} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <ActivityOverviewSection
        tab={tab}
        total={tab === "sessions" ? (timelineData?.total ?? 0) : data.total}
        items={data.items}
        sessionTotal={timelineData?.total}
      />

      <ActivityTabsNav activeTab={tab} query={activityQuery} />

      {tab === "flow" && tgData ? <EventsListChart items={tgData.items} /> : null}

      {tab === "sessions" && timelineData ? (
        <div className="space-y-2">
          {timelineData.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No session timelines found</p>
          ) : (
            timelineData.items.map((row) => (
              <SessionTimelineListRow
                key={row.id}
                sessionId={row.sessionId}
                walletAddress={row.walletAddress}
                network={row.network}
                status={row.status}
                message={row.message}
                ts={row.ts}
                durationMs={row.durationMs}
              />
            ))
          )}
          <Pagination
            page={timelineData.page}
            totalPages={timelineData.totalPages}
            basePath="/activity"
            query={activityQuery}
          />
        </div>
      ) : (
        <ListTableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                {(tab === "sessions" || tab === "flow") && (
                  <TableHead className="hidden md:table-cell">Context</TableHead>
                )}
                {(tab === "errors" || tab === "flow") && <TableHead>Error</TableHead>}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No activity found
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="uppercase">{row.network}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/users/${encodeURIComponent(row.address)}`}
                        className="text-primary hover:underline"
                      >
                        {shortAddress(row.address)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ActivityStatusChip status={row.status} />
                    </TableCell>
                    {(tab === "sessions" || tab === "flow") && (
                      <TableCell className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:table-cell">
                        {row.ip ?? "—"}
                        {row.location ? ` · ${row.location}` : ""}
                      </TableCell>
                    )}
                    {(tab === "errors" || tab === "flow") && (
                      <TableCell>
                        <ActivityErrorCell error={row.error} status={row.status} />
                      </TableCell>
                    )}
                    <TableCell className="space-y-1">
                      <Link
                        href={`/activity/${row.id}`}
                        className="block text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                      <ViewLogsLink params={{ walletAddress: row.address }} />
                    </TableCell>
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
      )}
    </ListPageLayout>
  );
}
