import { ErrorAlert } from "@/components/ErrorAlert";
import { PageFilters } from "@/components/FilterForm";
import { ApprovalsListChart, TransfersListChart } from "@/components/charts/ListPageCharts";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListTableCard } from "@/components/ListTableCard";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Pagination } from "@/components/Pagination";
import {
  PipelineTabsNav,
  type PipelineTab,
} from "@/components/pipeline/PipelineControls";
import { PipelineOverviewSection } from "@/components/pipeline/PipelineOverviewSection";
import { PipelineWorkflowStrip } from "@/components/pipeline/PipelineWorkflowStrip";
import {
  ApprovalsTable,
  NativeTransfersTable,
  TransfersTable,
  type ApprovalRow,
  type NativeRow,
  type TransferRow,
} from "@/components/pipeline/PipelineTables";
import { adminGetData, buildQuery } from "@/lib/admin-data";
import type { UserListResponse } from "@/types/users";

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit?: number;
  totalPages: number;
};

type DashboardSummary = {
  collector: {
    enabled: boolean;
    due: number;
    approvals: Record<string, number>;
    transfers: Record<string, number>;
  };
  nativeTransfers: Record<string, number>;
};

const APPROVAL_FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  {
    name: "status",
    label: "Status",
    options: [
      "SUBMITTED",
      "ACTIVE",
      "PARTIALLY_USED",
      "COMPLETED",
      "REVOKED",
      "EXPIRED",
      "FAILED",
    ],
  },
  {
    name: "collectionEnabled",
    label: "Collection",
    options: ["true", "false"],
  },
] as const;

const TRANSFER_FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. eth" },
  {
    name: "status",
    label: "Status",
    options: ["prepared", "broadcast", "pending", "confirmed", "failed"],
  },
] as const;

const NATIVE_FILTER_FIELDS = [
  { name: "network", label: "Network", placeholder: "e.g. tron" },
  {
    name: "status",
    label: "Status",
    options: ["pending", "confirmed", "failed"],
  },
] as const;

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

  const baseQuery = {
    page: sp.page ?? "1",
    limit: sp.limit ?? "25",
    owner,
    network: sp.network,
    status: sp.status,
    collectionEnabled: sp.collectionEnabled,
  };

  let dashboard: DashboardSummary | null = null;
  let userContext: UserListResponse["items"][0] | null = null;
  let listData: Paginated<ApprovalRow | TransferRow | NativeRow> | null = null;
  let error: string | null = null;

  try {
    const summaryPromise = adminGetData<DashboardSummary>("/admin/dashboard");
    const userPromise = owner
      ? adminGetData<UserListResponse>(
          `/admin/users${buildQuery({ search: owner, limit: "1" })}`
        ).catch(() => null)
      : Promise.resolve(null);

    let listPromise: Promise<Paginated<ApprovalRow | TransferRow | NativeRow>>;
    if (tab === "transfers") {
      listPromise = adminGetData<Paginated<TransferRow>>(
        `/admin/transfers${buildQuery({
          page: baseQuery.page,
          limit: baseQuery.limit,
          network: baseQuery.network,
          owner: baseQuery.owner,
          status: baseQuery.status,
        })}`
      );
    } else if (tab === "native") {
      listPromise = adminGetData<Paginated<NativeRow>>(
        `/admin/native-transfers${buildQuery({
          page: baseQuery.page,
          limit: baseQuery.limit,
          network: baseQuery.network,
          owner: baseQuery.owner,
          status: baseQuery.status,
        })}`
      );
    } else {
      listPromise = adminGetData<Paginated<ApprovalRow>>(
        `/admin/approvals${buildQuery({
          page: baseQuery.page,
          limit: baseQuery.limit,
          network: baseQuery.network,
          owner: baseQuery.owner,
          status: baseQuery.status,
          collectionEnabled: baseQuery.collectionEnabled,
        })}`
      );
    }

    const [summary, users, list] = await Promise.all([
      summaryPromise,
      userPromise,
      listPromise,
    ]);

    dashboard = summary;
    userContext = users?.items[0] ?? null;
    listData = list;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load pipeline";
  }

  if (error) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Pipeline"
          description="End-to-end transaction lifecycle — approvals, collections, and native funding"
          tip="Investigate the complete operational workflow from one place. Search by wallet address to trace approval → transfer → native funding without switching pages."
        />
        <ErrorAlert message={error} />
      </ListPageLayout>
    );
  }

  const c = dashboard!.collector;
  const filterFields =
    tab === "transfers"
      ? TRANSFER_FILTER_FIELDS
      : tab === "native"
        ? NATIVE_FILTER_FIELDS
        : APPROVAL_FILTER_FIELDS;

  const pipelineQuery = { ...sp, tab };

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Pipeline"
        description="End-to-end lifecycle — approvals, collections, and native funding"
        tip="Use the overview metrics and wallet search to trace a user. Tabs switch between approvals, token transfers, and native funding lists."
      >
        <PageToolbar>
          <PageRefreshButton />
          <PageFilters action="/pipeline" values={pipelineQuery} fields={[...filterFields]} />
        </PageToolbar>
      </PageHeader>

      <PipelineOverviewSection
        collector={c}
        nativeTransfers={dashboard!.nativeTransfers}
        tab={tab}
        listTotal={listData?.total ?? 0}
        owner={owner}
        pipelineQuery={pipelineQuery}
        filtersActive={Boolean(
          owner || sp.network || sp.status || sp.collectionEnabled
        )}
      />

      <PipelineWorkflowStrip
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

      <PipelineTabsNav activeTab={tab} query={pipelineQuery} />

      {tab === "approvals" && listData ? (
        <>
          <ApprovalsListChart items={listData.items as ApprovalRow[]} />
          <ListTableCard>
            <ApprovalsTable items={listData.items as ApprovalRow[]} />
          </ListTableCard>
        </>
      ) : null}

      {tab === "transfers" && listData ? (
        <>
          <TransfersListChart items={listData.items as TransferRow[]} />
          <ListTableCard>
            <TransfersTable items={listData.items as TransferRow[]} />
          </ListTableCard>
        </>
      ) : null}

      {tab === "native" && listData ? (
        <ListTableCard>
          <NativeTransfersTable items={listData.items as NativeRow[]} />
        </ListTableCard>
      ) : null}

      {listData ? (
        <Pagination
          page={listData.page}
          totalPages={listData.totalPages}
          basePath="/pipeline"
          query={pipelineQuery}
        />
      ) : null}
    </ListPageLayout>
  );
}
