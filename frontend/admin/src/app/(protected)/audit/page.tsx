import { ErrorAlert } from "@/components/ErrorAlert";
import { FilterForm } from "@/components/FilterForm";
import { PageHeader } from "@/components/PageHeader";
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
      <div className="space-y-4">
        <PageHeader
          title="Audit log"
          tip="Immutable-style trail of system and admin actions (confirm, transfer, settings updates). Expand payload JSON for the exact change."
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
          title="Audit log"
          tip="Immutable-style trail of system and admin actions (confirm, transfer, settings updates). Expand payload JSON for the exact change."
        />

      <FilterForm
        action="/audit"
        values={sp}
        fields={[
          { name: "action", label: "Action" },
          { name: "entityType", label: "Entity type" },
          { name: "actor", label: "Actor" },
        ]}
      />

      <div className="space-y-3">
        {data.items.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No audit entries found
            </CardContent>
          </Card>
        ) : (
          data.items.map((row) => (
            <Card key={row.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-medium">{row.action}</CardTitle>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{row.entityType}</span>
                  {row.entityId ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.entityId}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.createdAt)} · Actor: {row.actor}
                </p>
              </CardHeader>
              <CardContent>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} basePath="/audit" query={sp} />
    </div>
  );
}
