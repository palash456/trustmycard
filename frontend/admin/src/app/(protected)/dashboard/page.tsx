import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import {
  DashboardOverview,
} from "@/components/dashboard/DashboardOverview";
import {
  isDashboardPayloadEmpty,
  normalizeDashboardData,
  type DashboardData,
} from "@/lib/dashboard-data";
import { adminGetData } from "@/lib/admin-data";

export default async function DashboardPage() {
  let data: DashboardData;
  try {
    const raw = await adminGetData<unknown>("/admin/dashboard");
    if (isDashboardPayloadEmpty(raw)) {
      throw new Error("Dashboard API returned an empty payload");
    }
    data = normalizeDashboardData(raw);
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Dashboard"
          tip="Operational command center — queue backlog, pipeline status, and recent failures at a glance."
          description="Collector health and pipeline workload"
        />
        <ErrorAlert
          message={
            err instanceof Error ? err.message : "Failed to load dashboard"
          }
        />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Dashboard"
        tip="Operational command center — queue backlog, pipeline status, and recent failures at a glance."
        description="Collector health and pipeline workload"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <DashboardOverview data={data} />
    </ListPageLayout>
  );
}
