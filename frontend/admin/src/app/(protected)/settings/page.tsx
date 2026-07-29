import Link from "next/link";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { SettingsForm } from "@/components/SettingsForm";
import { adminGetData } from "@/lib/admin-data";

type SettingsResponse = {
  settings: Record<string, unknown>;
  lastReloadAt: string | null;
};

export default async function SettingsPage() {
  const data = await adminGetData<SettingsResponse>("/admin/settings");

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
      <p className="text-sm">
        <Link href="/settings/collector" className="text-primary hover:underline">
          Collector controls →
        </Link>
      </p>
    </ListPageLayout>
  );
}
