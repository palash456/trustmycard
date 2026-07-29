import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
import { EventsListChart } from "@/components/charts/ListPageCharts";
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
  { name: "type", label: "Type", placeholder: "e.g. connect" },
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  { name: "status", label: "Status", placeholder: "e.g. success" },
  { name: "address", label: "Address", placeholder: "Wallet address" },
] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    type: sp.type,
    network: sp.network,
    status: sp.status,
    address: sp.address,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/tg-events${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Flow events"
          tip="Connect / approve / native flow telemetry (TgLogEvent): status, IP, location, and errors from the website wallet session."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Flow events"
        description="Connect and authorization telemetry"
        tip="Connect / approve / native flow telemetry (TgLogEvent): status, IP, location, and errors from the website wallet session."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/events" values={sp} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <EventsListChart items={data.items} />

      <ListTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">IP / Location</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No events found
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
                  <TableCell className="font-mono text-xs">{shortAddress(row.address)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="hidden max-w-[120px] truncate text-xs text-muted-foreground md:table-cell">
                    {row.ip ?? "—"} · {row.location ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                    {row.error ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/events/${row.id}`} className="text-sm text-primary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ListTableCard>

      <Pagination page={data.page} totalPages={data.totalPages} basePath="/events" query={sp} />
    </ListPageLayout>
  );
}
