import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { formatDate } from "@/lib/format";

type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
  createdAt: string;
};

type ListResponse = {
  items: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
};

const FILTER_FIELDS = [
  { name: "action", label: "Action", placeholder: "e.g. settings.update" },
  { name: "entityType", label: "Entity type", placeholder: "e.g. Approval" },
  { name: "actor", label: "Actor", placeholder: "Actor id or email" },
] as const;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = buildQuery({
    page: sp.page ?? "1",
    action: sp.action,
    entityType: sp.entityType,
    actor: sp.actor,
  });

  let data: ListResponse;
  try {
    data = await adminGetData<ListResponse>(`/admin/audit-logs${query}`);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Audit log"
          description="Administrator actions and immutable system changes"
          tip="Dedicated trail of admin and system mutations (settings updates, manual transfers, collector toggles). For user flow telemetry, use Activity instead."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Audit log"
        description="Administrator actions and immutable system changes"
        tip="Dedicated trail of admin and system mutations (settings updates, manual transfers, collector toggles). For user flow telemetry, use Activity instead."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/audit" values={sp} fields={[...FILTER_FIELDS]} />
        </PageToolbar>
      </PageHeader>

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card className="border-border/60 shadow-none">
            <CardContent className="p-0">
              <ListEmptyState message="No audit entries found" />
            </CardContent>
          </Card>
        ) : (
          data.items.map((row) => (
            <Card key={row.id} className="border-border/60 shadow-none">
              <CardHeader className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-medium">{row.action}</CardTitle>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{row.entityType}</span>
                  {row.entityId ? (
                    <span className="font-mono text-xs text-muted-foreground">{row.entityId}</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.createdAt)} · Actor: {row.actor}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} basePath="/audit" query={sp} />
    </ListPageLayout>
  );
}
