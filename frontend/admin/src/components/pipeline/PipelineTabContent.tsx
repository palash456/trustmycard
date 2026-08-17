"use client";

import { useState } from "react";
import { PipelineOverviewSection } from "@/components/pipeline/PipelineOverviewSection";
import { PipelineListPanel } from "@/components/pipeline/PipelineListPanel";
import { PipelineListToolbar } from "@/components/pipeline/PipelineListToolbar";
import { PipelineTabsNav } from "@/components/pipeline/PipelineControls";
import { PipelineWorkflowStrip } from "@/components/pipeline/PipelineWorkflowStrip";
import type { PipelineTab } from "@/components/pipeline/PipelineControls";
import type { HealthStatus, WorkflowStage } from "@/types/users";

type CollectorSummary = {
  enabled: boolean;
  due: number;
  approvals: Record<string, number>;
  transfers: Record<string, number>;
};

type UserContext = {
  address: string;
  workflowStage: WorkflowStage;
  healthStatus: HealthStatus;
  approvalStatus: string | null;
  transferStatus: string | null;
  nativeFundingStatus: string | null;
} | null;

export function PipelineTabContent({
  tab,
  query,
  collector,
  nativeTransfers,
  owner,
  userContext,
}: {
  tab: PipelineTab;
  query: Record<string, string | undefined>;
  collector: CollectorSummary;
  nativeTransfers: Record<string, number>;
  owner?: string;
  userContext: UserContext;
}) {
  const [listTotal, setListTotal] = useState(0);

  const filtersActive = Boolean(
    owner || query.network || query.status || query.collectionEnabled,
  );

  const panelKey = [
    tab,
    owner,
    query.network,
    query.status,
    query.collectionEnabled,
  ].join("|");

  return (
    <>
      <PipelineOverviewSection
        collector={collector}
        nativeTransfers={nativeTransfers}
        tab={tab}
        listTotal={listTotal}
        owner={owner}
        pipelineQuery={query}
        filtersActive={filtersActive}
      />

      <PipelineWorkflowStrip owner={owner} userContext={userContext} />

      <PipelineTabsNav activeTab={tab} query={query} />

      <PipelineListPanel
        key={panelKey}
        tab={tab}
        query={query}
        onTotalChange={setListTotal}
        toolbar={<PipelineListToolbar tab={tab} query={query} />}
      />
    </>
  );
}
