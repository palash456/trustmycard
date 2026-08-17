import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { AnalyticsDateRangeSelect } from "@/components/analytics/AnalyticsDateRangeSelect";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { adminGetData } from "@/lib/admin-data";
import { buildQuery } from "@/lib/admin-api";
import type { AnalyticsResponse } from "@/types/analytics";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const period = sp.period ?? "last30d";
  const query = buildQuery({
    period,
    from: sp.from,
    to: sp.to,
  });

  let data: AnalyticsResponse;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      data = await adminGetData<AnalyticsResponse>(`/admin/analytics${query}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Analytics"
          description="Executive dashboard"
          tip="Platform performance and revenue from production data."
        />
        <ErrorAlert
          message={
            err instanceof Error ? err.message : "Failed to load analytics"
          }
        />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout>
      <PageHeader
        title="Analytics"
        description="Revenue, users, and operational performance"
        tip="Start with the executive snapshot for health and revenue. Use the date range filter to scope time-series metrics."
      >
        <PageToolbar>
          <PageRefreshButton />
          <AnalyticsDateRangeSelect period={period} from={sp.from} to={sp.to} />
        </PageToolbar>
      </PageHeader>

      <AnalyticsDashboard data={data} />
    </ListPageLayout>
  );
}
