import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PipelineSearch } from "@/components/pipeline/PipelineControls";
import type { PipelineTab } from "@/components/pipeline/PipelineControls";
import { cn } from "@/lib/utils";

type CollectorSummary = {
  enabled: boolean;
  due: number;
  approvals: Record<string, number>;
  transfers: Record<string, number>;
};

function activeApprovals(approvals: Record<string, number>): number {
  return (
    (approvals.ACTIVE ?? 0) +
    (approvals.SUBMITTED ?? 0) +
    (approvals.PARTIALLY_USED ?? 0)
  );
}

function pendingTransfers(transfers: Record<string, number>): number {
  return (
    (transfers.prepared ?? 0) +
    (transfers.broadcast ?? 0) +
    (transfers.pending ?? 0)
  );
}

const TAB_META: Record<
  PipelineTab,
  { title: string; description: string; href: string }
> = {
  approvals: {
    title: "Token approvals",
    description: "Allowances granted and queued for collection",
    href: "/approvals",
  },
  transfers: {
    title: "Collection transfers",
    description: "Token moves from user wallet to collector",
    href: "/transfers",
  },
  native: {
    title: "Native funding",
    description: "Gas / TRX sent back to user wallets",
    href: "/native-transfers",
  },
};

export function PipelineOverviewSection({
  collector,
  nativeTransfers,
  tab,
  listTotal,
  owner,
  pipelineQuery,
}: {
  collector: CollectorSummary;
  nativeTransfers: Record<string, number>;
  tab: PipelineTab;
  listTotal: number;
  owner?: string;
  pipelineQuery: Record<string, string | undefined>;
}) {
  const failedApprovals = collector.approvals.FAILED ?? 0;
  const failedTransfers = collector.transfers.failed ?? 0;
  const failedNative = nativeTransfers.failed ?? 0;
  const totalFailures = failedApprovals + failedTransfers + failedNative;
  const tabMeta = TAB_META[tab];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
          <StatCard
            label="Active approvals"
            value={activeApprovals(collector.approvals)}
            sub={`${collector.due} due now`}
            className={collector.due > 0 ? "ring-1 ring-amber-500/25" : undefined}
          />
          <StatCard
            label="Transfers in-flight"
            value={pendingTransfers(collector.transfers)}
            sub={`${collector.transfers.confirmed ?? 0} confirmed`}
          />
          <StatCard
            label="Native pending"
            value={nativeTransfers.pending ?? 0}
            sub={`${nativeTransfers.confirmed ?? 0} confirmed`}
          />
          <StatCard
            label="Failures"
            value={totalFailures}
            sub={`${failedApprovals} approvals · ${failedNative} native`}
            className={totalFailures > 0 ? "ring-1 ring-destructive/20" : undefined}
          />
        </div>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="font-brand text-sm">Collector</CardTitle>
            <CardDescription>
              {collector.enabled ? "Auto-collection enabled" : "Manual mode — jobs won’t run"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {collector.enabled ? "Running" : "Stopped"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {collector.due} approvals waiting
              </p>
            </div>
            <Link
              href="/settings/collector"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Settings
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={cn("border-0 lg:col-span-2", owner && "ring-1 ring-primary/15")}>
          <CardHeader className="pb-3">
            <CardTitle className="font-brand text-base">Trace a wallet</CardTitle>
            <CardDescription>
              Search by address to see lifecycle stage, health, and open the full pipeline view
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineSearch owner={owner} tab={tab} query={pipelineQuery} />
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="font-brand text-sm">{tabMeta.title}</CardTitle>
            <CardDescription>{tabMeta.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">{listTotal}</p>
            <p className="text-xs text-muted-foreground">Rows matching current filters</p>
            <Link
              href={tabMeta.href}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open dedicated list
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
