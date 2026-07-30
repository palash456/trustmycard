import Link from "next/link";
import { ListPageLayout } from "@/components/ListPageLayout";
import { MetricsPanel } from "@/components/system/MetricsPanel";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { SystemPanel } from "@/components/SystemPanel";
import { adminGetData } from "@/lib/admin-data";
import type { MetricsSnapshot } from "@/lib/observability";

export default async function SystemPage() {
  const [status, metrics] = await Promise.all([
    adminGetData<Record<string, unknown>>("/admin/system/status"),
    adminGetData<MetricsSnapshot>("/admin/metrics").catch(() => null),
  ]);

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="System"
        tip="Secrets metadata (configured vs spender match), worker health, in-process metrics, and optional local-only restart buttons when ADMIN_DEV_OPS=true."
        description="Secrets metadata, dev ops, worker health, and metrics"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      {metrics ? <MetricsPanel metrics={metrics} /> : null}
      <SystemPanel status={status} />
      <p className="text-sm">
        <Link href="/audit?tab=structured&module=observability" className="text-primary hover:underline">
          View observability persist logs →
        </Link>
      </p>
    </ListPageLayout>
  );
}
