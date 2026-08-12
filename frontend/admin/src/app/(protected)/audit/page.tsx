import { redirect } from "next/navigation";
import { StructuredLogsSection } from "@/components/audit/StructuredLogsSection";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";

function redirectLegacyAuditTab(
  sp: Record<string, string | undefined>,
): void {
  const tab = sp.tab;
  if (!tab || tab === "structured") return;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (!value?.trim() || key === "tab") continue;
    params.set(key, value.trim());
  }

  if (tab === "admin") {
    redirect(
      params.size > 0
        ? `/admin-actions?${params.toString()}`
        : "/admin-actions",
    );
  }

  if (tab === "timelines") {
    redirect(params.size > 0 ? `/transactions?${params.toString()}` : "/transactions");
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  redirectLegacyAuditTab(sp);

  return (
    <ListPageLayout>
      <PageHeader
        title="Audit & logs"
        description="Structured observability events — search by flow-* transaction ID, module, level, and more"
        tip="Logs are keyed by transaction journey ID (sessionId / traceId). Use the Transactions page for full journey context."
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <StructuredLogsSection query={sp} />
    </ListPageLayout>
  );
}
