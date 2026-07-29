import Link from "next/link";
import { ErrorAlert } from "@/components/ErrorAlert";
import { EventsListChart } from "@/components/charts/ListPageCharts";
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
      <div className="space-y-4">
        <PageHeader
          title="Flow events"
          tip="Connect / approve / native flow telemetry (TgLogEvent): status, IP, location, and errors from the website wallet session."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Flow events"
          tip="Connect / approve / native flow telemetry (TgLogEvent): status, IP, location, and errors from the website wallet session."
          description="Connect and authorization telemetry"
        />

      <FilterForm
        action="/events"
        values={sp}
        fields={[
          { name: "type", label: "Type" },
          { name: "network", label: "Network" },
          { name: "status", label: "Status" },
          { name: "address", label: "Address" },
        ]}
      />

      <EventsListChart items={data.items} />

      <Card className="shadow-sm">
        <CardContent className="p-0">
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
              {data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell className="uppercase">{row.network}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {shortAddress(row.address)}
                  </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground hidden md:table-cell">
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination page={data.page} totalPages={data.totalPages} basePath="/events" query={sp} />
    </div>
  );
}
