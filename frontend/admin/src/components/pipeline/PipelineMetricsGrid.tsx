import { StatCard } from "@/components/StatCard";
import type { PipelineMetrics } from "@/types/pipeline";

export function PipelineMetricsGrid({ metrics }: { metrics: PipelineMetrics }) {
  const avgProcessing =
    metrics.averageProcessingMs != null
      ? `${Math.round(metrics.averageProcessingMs / 1000)}s`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Requested assets"
        value={metrics.requested}
        sub={`${metrics.approved} approved`}
      />
      <StatCard
        label="Transfers successful"
        value={metrics.transfersSuccessful}
        sub={`${metrics.transfersAwaiting} awaiting · ${metrics.transfersFailed} failed`}
      />
      <StatCard
        label="On-chain verified"
        value={metrics.onChainVerified}
        sub={`${metrics.pendingConfirmations} pending confirmation`}
      />
      <StatCard
        label="Pipeline success rate"
        value={`${Math.round(metrics.successRate)}%`}
        sub={`${metrics.pipelinesCompleted} completed · avg ${avgProcessing}`}
      />
      <StatCard label="Retries" value={metrics.retries} sub={`${metrics.repaired} repaired`} />
      <StatCard
        label="Failed transfers"
        value={metrics.transfersFailed}
        sub="Terminal failures only"
      />
      <StatCard
        label="Awaiting"
        value={metrics.transfersAwaiting}
        sub="Broadcast / pending confirmation"
      />
      <StatCard
        label="Completed pipelines"
        value={metrics.pipelinesCompleted}
        sub="Per detected asset"
      />
    </div>
  );
}
