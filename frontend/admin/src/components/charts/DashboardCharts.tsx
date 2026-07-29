"use client";

import { StatusBarChart, StatusDonutChart } from "@/components/charts/StatusCharts";

export function DashboardCharts({
  approvals,
  transfers,
  nativeTransfers,
}: {
  approvals: Record<string, number>;
  transfers: Record<string, number>;
  nativeTransfers: Record<string, number>;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <StatusDonutChart
        title="Approvals by status"
        description="Distribution of token allowance records in the pipeline"
        data={approvals}
      />
      <StatusBarChart
        title="Transfers by status"
        description="Collector transferFrom executions grouped by outcome"
        data={transfers}
      />
      <StatusBarChart
        title="Native transfers by status"
        description="User-signed native coin transfers on-chain reconciliation"
        data={nativeTransfers}
        className="lg:col-span-2"
      />
    </div>
  );
}
