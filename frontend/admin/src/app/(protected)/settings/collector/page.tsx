import Link from "next/link";
import { CollectorPanel } from "@/components/CollectorPanel";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { adminGetData } from "@/lib/admin-data";

export default async function CollectorSettingsPage() {
  const status = await adminGetData<Record<string, unknown>>("/admin/system/status");

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Collector"
        tip="Force a collector tick, release stuck leases, or enable/disable the worker without restarting Nest."
        description="Runtime collector controls and lease management"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      <Link href="/settings" className="text-sm text-primary hover:underline">
        ← All settings
      </Link>
      <CollectorPanel status={status} />
    </ListPageLayout>
  );
}
