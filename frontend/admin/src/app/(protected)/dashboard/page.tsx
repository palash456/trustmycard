import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { StatCard } from "@/components/StatCard";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";

type Dashboard = {
  collector: {
    enabled: boolean;
    due: number;
    leased: number;
    approvals: Record<string, number>;
    transfers: Record<string, number>;
  };
  nativeTransfers: Record<string, number>;
  recentFailures: {
    approvals: Array<{
      id: string;
      network: string;
      ownerAddress: string;
      tokenSymbol: string;
      status: string;
      lastError: string | null;
    }>;
    nativeTransfers: Array<{
      id: string;
      network: string;
      ownerAddress: string;
      assetSymbol: string;
      status: string;
      errorMessage: string | null;
    }>;
  };
};

export default async function DashboardPage() {
  let data: Dashboard;
  try {
    data = await adminGetData<Dashboard>("/admin/dashboard");
  } catch (err) {
    return (
      <ListPageLayout>
        <PageHeader
          title="Dashboard"
          tip="High-level health of the collector pipeline: due approvals, status histograms, native pending/failed counts, and recent errors so you can spot stuck work quickly."
          description="Collector and pipeline overview"
        />
        <ErrorAlert message={err instanceof Error ? err.message : "Failed to load dashboard"} />
      </ListPageLayout>
    );
  }

  const c = data.collector;

  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Dashboard"
        tip="High-level health of the collector pipeline: due approvals, status histograms, native pending/failed counts, and recent errors so you can spot stuck work quickly."
        description="Collector and transfer pipeline overview"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collector"
          value={c.enabled ? "Enabled" : "Disabled"}
          sub={`${c.due} due · ${c.leased} leased`}
        />
        <StatCard
          label="Active approvals"
          value={
            (c.approvals.ACTIVE ?? 0) +
            (c.approvals.SUBMITTED ?? 0) +
            (c.approvals.PARTIALLY_USED ?? 0)
          }
        />
        <StatCard label="Pending native" value={data.nativeTransfers.pending ?? 0} />
        <StatCard label="Failed native" value={data.nativeTransfers.failed ?? 0} />
      </div>

      <DashboardCharts
        approvals={c.approvals}
        transfers={c.transfers}
        nativeTransfers={data.nativeTransfers}
      />

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="font-brand text-base">Recent failures</CardTitle>
          <CardDescription>Approvals and native transfers with errors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentFailures.approvals.map((a) => (
            <div
              key={a.id}
              className="rounded-lg bg-muted/35 px-4 py-3 text-sm ring-1 ring-black/[0.03]"
            >
              <Link
                href={`/approvals/${a.id}`}
                className="font-medium text-primary hover:underline"
              >
                {a.network.toUpperCase()} {a.tokenSymbol}
              </Link>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {a.ownerAddress}
              </p>
              <p className="mt-2 text-destructive">{a.lastError}</p>
            </div>
          ))}
          {data.recentFailures.nativeTransfers.map((n) => (
            <div
              key={n.id}
              className="rounded-lg bg-muted/35 px-4 py-3 text-sm ring-1 ring-black/[0.03]"
            >
              <Link
                href={`/native-transfers/${n.id}`}
                className="font-medium text-primary hover:underline"
              >
                {n.network.toUpperCase()} {n.assetSymbol}
              </Link>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {n.ownerAddress}
              </p>
              <p className="mt-2 text-destructive">{n.errorMessage}</p>
            </div>
          ))}
          {data.recentFailures.approvals.length === 0 &&
          data.recentFailures.nativeTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent failures</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/pipeline"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open pipeline
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/pipeline?tab=native"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Native transfers
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </ListPageLayout>
  );
}
