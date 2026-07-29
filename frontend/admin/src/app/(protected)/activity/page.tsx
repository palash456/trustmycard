import Link from "next/link";
import { EventsListChart } from "@/components/charts/ListPageCharts";
import { ActivityTabsNav, type ActivityTab } from "@/components/activity/ActivityTabsNav";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { StatCard } from "@/components/StatCard";
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

type TgEvent = {
  id: string;
  type: string;
  network: string;
  address: string;
  status: string;
  error: string | null;
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

function tabQueryParams(tab: ActivityTab): Record<string, string | undefined> {
  switch (tab) {
    case "connections":
      return { type: "connect" };
    case "errors":
      return { status: "error" };
    default:
      return {};
  }
}

function countErrors(items: TgEvent[]): number {
  return items.filter((e) => e.error || e.status === "error").length;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const tabFilters = tabQueryParams(tab);

  const query = buildQuery({
    page: sp.page ?? "1",
    network: sp.network,
    address: sp.address,
    ...tabFilters,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/tg-events${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Activity"
          description="Operational monitoring — understand what happened across flows, users, and sessions"
          tip="User and system telemetry from the wallet flow. For administrator actions, use Audit log instead."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </ListPageLayout>
    );
  }

  const activityQuery = { ...sp, tab };
  const errorCount = countErrors(data.items);
  const uniqueAddresses = new Set(data.items.map((e) => e.address)).size;

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Activity"
        description="Operational monitoring — understand what happened across flows, users, and sessions"
        tip="User and system telemetry from the wallet flow. For administrator actions, use Audit log instead."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/activity" values={activityQuery} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events" value={data.total} sub="Matching current filters" />
        <StatCard label="On this page" value={data.items.length} sub={`Page ${data.page}`} />
        <StatCard
          label="With errors"
          value={tab === "errors" ? data.total : errorCount}
          sub="Failed or rejected"
        />
        <StatCard label="Unique wallets" value={uniqueAddresses} sub="On this page" />
      </div>

      <ActivityTabsNav activeTab={tab} query={activityQuery} />

      {tab === "flow" ? <EventsListChart items={data.items} /> : null}

      <ListTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>
                {tab === "user" || tab === "sessions" ? "User" : "Address"}
              </TableHead>
              <TableHead>Status</TableHead>
              {(tab === "sessions" || tab === "flow") && (
                <TableHead className="hidden md:table-cell">Session</TableHead>
              )}
              {(tab === "errors" || tab === "flow") && <TableHead>Error</TableHead>}
              <TableHead>Detail</TableHead>
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
                  <TableCell>{row.status}</TableCell>
                  {(tab === "sessions" || tab === "flow") && (
                    <TableCell className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:table-cell">
                      {row.ip ?? "—"} · {row.location ?? "—"}
                    </TableCell>
                  )}
                  {(tab === "errors" || tab === "flow") && (
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {row.error ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`/activity/${row.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View
                    </Link>
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
        basePath="/activity"
        query={activityQuery}
      />
    </ListPageLayout>
  );
}
