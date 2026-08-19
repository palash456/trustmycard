import { AuditRefreshClient } from "@/components/audit/AuditRefreshClient";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
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
import type { AuditLogRow, PaginatedResponse } from "@/lib/observability";

const FILTER_FIELDS = [
  { name: "action", label: "Action", placeholder: "e.g. settings.update" },
  { name: "entityType", label: "Entity type", placeholder: "e.g. settings" },
  { name: "entityId", label: "Entity ID", placeholder: "Entity id" },
  { name: "actor", label: "Actor", placeholder: "Actor id or email" },
  { name: "from", label: "From (ISO date)", placeholder: "2026-01-01" },
  { name: "to", label: "To (ISO date)", placeholder: "2026-12-31" },
] as const;

export default async function AdminActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  let error: string | null = null;
  let data: PaginatedResponse<AuditLogRow> | null = null;

  try {
    data = await adminGetData<PaginatedResponse<AuditLogRow>>(
      `/admin/audit-logs${buildQuery({
        page: sp.page ?? "1",
        search: sp.search,
        sort: sp.sort ?? "createdAt:desc",
        limit: sp.limit ?? "25",
        action: sp.action,
        entityType: sp.entityType,
        entityId: sp.entityId,
        actor: sp.actor,
        from: sp.from,
        to: sp.to,
      })}`,
      undefined,
      { bypassDemo: true },
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <ListPageLayout>
      <AuditRefreshClient tab="admin" />
      <PageHeader
        title="Admin actions"
        description="Settings updates, collector toggles, manual transfers, and other admin mutations"
        tip="Each entry records who changed what, when, and the full payload. Filter by action, entity, or actor."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters
            action="/admin-actions"
            values={sp}
            fields={[...FILTER_FIELDS]}
          />
        </PageToolbar>
      </PageHeader>

      <div className="mt-4">
        <LogSearchBar
          action="/admin-actions"
          defaultValue={sp.search}
          query={sp}
          placeholder="Search admin actions…"
        />
      </div>

      {error ? (
        <ErrorAlert message={error} />
      ) : !data || data.items.length === 0 ? (
        <Card className="mt-4 border-border/60 shadow-none">
          <CardContent className="p-0">
            <ListEmptyState message="No admin actions found" />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {data.items.map((row) => (
            <Card key={row.id} className="border-border/60 shadow-none">
              <CardHeader className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {row.action}
                  </CardTitle>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">
                    {row.entityType}
                  </span>
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
              <CardContent className="px-4 pb-4 pt-0">
                <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            basePath="/admin-actions"
            query={sp}
          />
        </div>
      )}
    </ListPageLayout>
  );
}
