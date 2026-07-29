import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { SystemPanel } from "@/components/SystemPanel";
import { adminGetData } from "@/lib/admin-data";

export default async function SystemPage() {
  const status = await adminGetData<Record<string, unknown>>("/admin/system/status");

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="System"
        tip="Secrets metadata (configured vs spender match), worker health, and optional local-only restart buttons when ADMIN_DEV_OPS=true."
        description="Secrets metadata, dev ops, and worker health"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      <SystemPanel status={status} />
    </ListPageLayout>
  );
}
