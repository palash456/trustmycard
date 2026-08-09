import Link from "next/link";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { SettingsForm } from "@/components/SettingsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import { auditAdminLink } from "@/lib/log-links";
import { formatDate } from "@/lib/format";
import type { AuditLogRow, PaginatedResponse } from "@/lib/observability";

type SettingsResponse = {
  settings: Record<string, unknown>;
  lastReloadAt: string | null;
};

export default async function SettingsPage() {
  const [data, recentAudits] = await Promise.all([
    adminGetData<SettingsResponse>("/admin/settings"),
    adminGetData<PaginatedResponse<AuditLogRow>>(
      `/admin/audit-logs${buildQuery({ entityType: "settings", limit: "5", sort: "createdAt:desc" })}`,
    ).catch(() => null),
  ]);

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Settings"
        tip="Runtime AppSettings with env fallbacks: permissions like allow-self-spender, collector knobs, collection defaults, native reconcile, and TRON energy sponsorship."
        description="Runtime platform settings stored in DB with env fallbacks"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      <SettingsForm initial={data.settings} lastReloadAt={data.lastReloadAt} />
      {recentAudits && recentAudits.items.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent settings changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentAudits.items.map((row) => (
              <p key={row.id} className="text-muted-foreground">
                {formatDate(row.createdAt)} · {row.action} · {row.actor}
              </p>
            ))}
            <Link
              href={auditAdminLink({ entityType: "settings" })}
              className="text-primary hover:underline"
            >
              View all in Audit & logs →
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <p className="text-sm">
        <Link
          href="/settings/collector"
          className="text-primary hover:underline"
        >
          Collector controls →
        </Link>
      </p>
    </ListPageLayout>
  );
}
