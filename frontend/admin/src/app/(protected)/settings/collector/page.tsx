import Link from "next/link";
import { CollectorPanel } from "@/components/CollectorPanel";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { adminGetData } from "@/lib/admin-data";

export default async function CollectorSettingsPage() {
  const [status, collection] = await Promise.all([
    adminGetData<Record<string, unknown>>("/admin/system/status"),
    adminGetData<Record<string, unknown>>("/admin/collections/status"),
  ]);

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Collection workers"
        tip="Queue, outbox and recovery status for event-driven collection."
        description="Collection dispatch and recovery operations"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      <Link href="/settings" className="text-sm text-primary hover:underline">
        ← All settings
      </Link>
      <CollectorPanel status={status} collection={collection} />
    </ListPageLayout>
  );
}
