import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { PipelineTabContent } from "@/components/pipeline/PipelineTabContent";
import type { PipelineTab } from "@/components/pipeline/PipelineControls";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import type { UserListResponse } from "@/types/users";

type DashboardSummary = {
  collector: {
    enabled: boolean;
    due: number;
    approvals: Record<string, number>;
    transfers: Record<string, number>;
  };
  nativeTransfers: Record<string, number>;
};

function parseTab(value: string | undefined): PipelineTab {
  if (value === "transfers" || value === "native") return value;
  return "approvals";
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const owner = sp.owner?.trim() || undefined;
  const pipelineQuery = { ...sp, tab };

  let dashboard: DashboardSummary | null = null;
  let userContext: UserListResponse["items"][0] | null = null;
  let error: string | null = null;

  try {
    const summaryPromise = adminGetData<DashboardSummary>("/admin/dashboard");
    const userPromise = owner
      ? adminGetData<UserListResponse>(
          `/admin/users${buildQuery({ search: owner, limit: "1" })}`,
        ).catch(() => null)
      : Promise.resolve(null);

    const [summary, users] = await Promise.all([summaryPromise, userPromise]);
    dashboard = summary;
    userContext = users?.items[0] ?? null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load pipeline";
  }

  if (error || !dashboard) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Pipeline"
          description="Operational lists by transaction journey — approvals, collections, and native funding"
          tip="Each row links to a flow-* transaction ID. Use Transactions for journey search."
        />
        <ErrorAlert message={error ?? "Failed to load pipeline"} />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Pipeline"
        description="Operational lists by transaction journey — approvals, collections, and native funding"
        tip="Each row links to a flow-* transaction ID. Use Transactions for journey search; filter by wallet to scope lists here."
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <PipelineTabContent
        tab={tab}
        query={pipelineQuery}
        collector={dashboard.collector}
        nativeTransfers={dashboard.nativeTransfers}
        owner={owner}
        userContext={
          userContext
            ? {
                address: userContext.address,
                workflowStage: userContext.workflowStage,
                healthStatus: userContext.healthStatus,
                approvalStatus: userContext.approvalStatus,
                transferStatus: userContext.transferStatus,
                nativeFundingStatus: userContext.nativeFundingStatus,
              }
            : null
        }
      />
    </ListPageLayout>
  );
}
