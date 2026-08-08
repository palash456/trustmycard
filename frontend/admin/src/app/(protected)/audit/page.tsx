import Link from "next/link";
import { AuditRefreshClient } from "@/components/audit/AuditRefreshClient";
import { AuditTabsNav } from "@/components/audit/AuditTabsNav";
import { LogSearchBar } from "@/components/audit/LogSearchBar";
import { SessionTimelineListRow } from "@/components/audit/SessionTimelineView";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGetLogData, buildQuery } from "@/lib/admin-data";
import { formatDate } from "@/lib/format";
import type { AuditTab } from "@/lib/log-links";
import { timelineDetailLink } from "@/lib/log-links";
import type {
  AuditLogRow,
  ObservabilityEventRow,
  PaginatedResponse,
} from "@/lib/observability";

const ADMIN_FILTER_FIELDS = [
  { name: "action", label: "Action", placeholder: "e.g. settings.update" },
  { name: "entityType", label: "Entity type", placeholder: "e.g. settings" },
  { name: "entityId", label: "Entity ID", placeholder: "Entity id" },
  { name: "actor", label: "Actor", placeholder: "Actor id or email" },
  { name: "from", label: "From (ISO date)", placeholder: "2026-01-01" },
  { name: "to", label: "To (ISO date)", placeholder: "2026-12-31" },
] as const;

const STRUCTURED_FILTER_FIELDS = [
  { name: "module", label: "Module", placeholder: "e.g. connect" },
  { name: "operation", label: "Operation", placeholder: "e.g. post_confirm" },
  { name: "stage", label: "Stage", placeholder: "Stage name" },
  { name: "status", label: "Status", placeholder: "failure" },
  {
    name: "level",
    label: "Level",
    options: ["trace", "debug", "info", "warn", "error", "fatal"],
  },
  { name: "walletAddress", label: "Wallet", placeholder: "Address" },
  { name: "sessionId", label: "Session ID", placeholder: "Session id" },
  { name: "traceId", label: "Trace ID", placeholder: "Trace id" },
  { name: "txHash", label: "Tx hash", placeholder: "Transaction hash" },
  { name: "errorCode", label: "Error code", placeholder: "Error code" },
  { name: "from", label: "From (ISO date)", placeholder: "2026-01-01" },
  { name: "to", label: "To (ISO date)", placeholder: "2026-12-31" },
] as const;

const TIMELINE_FILTER_FIELDS = [
  { name: "walletAddress", label: "Wallet", placeholder: "Address" },
  { name: "sessionId", label: "Session ID", placeholder: "Session id" },
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  { name: "from", label: "From (ISO date)", placeholder: "2026-01-01" },
  { name: "to", label: "To (ISO date)", placeholder: "2026-12-31" },
] as const;

function parseTab(value: string | undefined): AuditTab {
  if (value === "structured" || value === "timelines") return value;
  return "admin";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const commonQuery = {
    page: sp.page ?? "1",
    search: sp.search,
    sort: sp.sort ?? (tab === "admin" ? "createdAt:desc" : "ts:desc"),
    limit: sp.limit ?? "25",
  };

  let error: string | null = null;
  let adminData: PaginatedResponse<AuditLogRow> | null = null;
  let obsData: PaginatedResponse<ObservabilityEventRow> | null = null;

  try {
    if (tab === "admin") {
      adminData = await adminGetLogData<PaginatedResponse<AuditLogRow>>(
        `/admin/audit-logs${buildQuery({
          ...commonQuery,
          action: sp.action,
          entityType: sp.entityType,
          entityId: sp.entityId,
          actor: sp.actor,
          from: sp.from,
          to: sp.to,
        })}`
      );
    } else {
      obsData = await adminGetLogData<PaginatedResponse<ObservabilityEventRow>>(
        `/admin/observability/events${buildQuery({
          ...commonQuery,
          tab,
          module: sp.module,
          operation: sp.operation,
          stage: sp.stage,
          status: sp.status,
          level: sp.level,
          walletAddress: sp.walletAddress,
          sessionId: sp.sessionId,
          traceId: sp.traceId,
          correlationId: sp.correlationId,
          txHash: sp.txHash,
          errorCode: sp.errorCode,
          network: sp.network,
          from: sp.from,
          to: sp.to,
        })}`
      );
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load";
  }

  const filterFields =
    tab === "admin"
      ? ADMIN_FILTER_FIELDS
      : tab === "structured"
        ? STRUCTURED_FILTER_FIELDS
        : TIMELINE_FILTER_FIELDS;

  const pageData = tab === "admin" ? adminData : obsData;

  return (
    <ListPageLayout>
      <AuditRefreshClient tab={tab} />
      <PageHeader
        title="Audit & logs"
        description="Admin mutations, structured observability events, and session timelines"
        tip="Use Admin actions for panel changes, Structured logs for wallet flow diagnostics, and Session timelines for full authorization journeys."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/audit" values={sp} fields={[...filterFields]} />
        </PageToolbar>
      </PageHeader>

      <AuditTabsNav activeTab={tab} query={sp} />

      <div className="mt-4">
        <LogSearchBar action="/audit" defaultValue={sp.search} query={sp} />
      </div>

      {error ? (
        <ErrorAlert message={error} />
      ) : !pageData || pageData.items.length === 0 ? (
        <Card className="mt-4 border-border/60 shadow-none">
          <CardContent className="p-0">
            <ListEmptyState message={`No ${tab} entries found`} />
          </CardContent>
        </Card>
      ) : tab === "admin" && adminData ? (
        <div className="mt-4 space-y-3">
          {adminData.items.map((row) => (
            <Card key={row.id} className="border-border/60 shadow-none">
              <CardHeader className="space-y-1 px-4 py-3">
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
              <CardContent className="px-4 pb-4 pt-0">
                <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
          <Pagination
            page={adminData.page}
            totalPages={adminData.totalPages}
            basePath="/audit"
            query={sp}
          />
        </div>
      ) : tab === "timelines" && obsData ? (
        <div className="mt-4 space-y-2">
          {obsData.items.map((row) => (
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
          ))}
          <Pagination
            page={obsData.page}
            totalPages={obsData.totalPages}
            basePath="/audit"
            query={sp}
          />
        </div>
      ) : obsData ? (
        <Card className="mt-4 border-border/60 shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Wallet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obsData.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(row.ts)}
                    </TableCell>
                    <TableCell>
                      {row.level ? (
                        <Badge variant="outline" className="text-[10px]">
                          {row.level}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.module}/{row.operation}
                      {row.stage ? ` · ${row.stage}` : ""}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={row.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {row.message}
                      {row.errorMessage ? (
                        <span className="block text-destructive">{row.errorMessage}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.walletAddress ? (
                        <Link
                          href={`/users/${encodeURIComponent(row.walletAddress)}`}
                          className="text-primary hover:underline"
                        >
                          {row.walletAddress.slice(0, 10)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                      {row.sessionId ? (
                        <Link
                          href={timelineDetailLink(row.sessionId)}
                          className="ml-1 block text-primary hover:underline"
                        >
                          timeline
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination
            page={obsData.page}
            totalPages={obsData.totalPages}
            basePath="/audit"
            query={sp}
          />
        </Card>
      ) : null}
    </ListPageLayout>
  );
}
