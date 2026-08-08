"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CheckCircle2,
  Coins,
  Link2,
  Wallet,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { activityLink } from "@/lib/log-links";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserPipelineSnapshot } from "@/types/pipeline";
import {
  buildFlowchartMetadata,
  buildVerticalFlowchartLayout,
  type AssetBranchSlot,
  type FlowchartBalanceGroup,
  type FlowchartStage,
} from "@/lib/pipeline-flowchart";

const ICONS = {
  wallet: Wallet,
  approval: CheckCircle2,
  collection: ArrowLeftRight,
  native: Coins,
  reconcile: Link2,
  complete: CheckCircle2,
} as const;

function badgeClass(stage: FlowchartStage): string {
  if (stage.badgeLabel === "COMPLETED WITH RETRY") {
    return "border-orange-500/50 bg-orange-500/20 text-orange-300";
  }
  switch (stage.status) {
    case "completed":
      return "border-green-500/50 bg-green-500/20 text-green-300";
    case "active":
      return "border-sky-400/50 bg-sky-500/20 text-sky-300";
    case "failed":
      return "border-red-500/50 bg-red-500/20 text-red-300";
    case "skipped":
      return "border-white/20 bg-white/10 text-white/60";
    default:
      return "border-white/25 bg-white/10 text-white/80";
  }
}

function detailBadgeClass(stage: FlowchartStage): string {
  if (stage.badgeLabel === "COMPLETED WITH RETRY") {
    return "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-400";
  }
  switch (stage.status) {
    case "completed":
      return "border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-400";
    case "active":
      return "border-primary/40 bg-primary/15 text-primary";
    case "failed":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    case "skipped":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

function BalanceGroupsPanel({ groups }: { groups: FlowchartBalanceGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-md border bg-muted/40 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Balances
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Not fetched or unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Balances by chain
      </p>
      <div className="grid max-h-[40vh] gap-2 overflow-y-auto sm:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.network}
            className="rounded-md border bg-muted/40 px-2.5 py-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground">
              {group.network}
            </p>
            <dl className="mt-1.5 space-y-1">
              {group.assets.map((asset) => (
                <div key={`${group.network}-${asset.symbol}`} className="flex items-center justify-between gap-2 text-xs">
                  <dt className="text-muted-foreground">{asset.symbol}</dt>
                  <dd className="font-medium tabular-nums">{asset.amount}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageHoverContent({ stage }: { stage: FlowchartStage }) {
  const showBalancePanel = stage.key === "wallet_linked";

  return (
    <div className="space-y-3 p-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{stage.label}</p>
          <p className="text-xs text-muted-foreground">{stage.subtitle}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            detailBadgeClass(stage)
          )}
        >
          {stage.badgeLabel}
        </span>
      </div>
      {stage.at ? (
        <p className="text-xs text-muted-foreground">{formatDate(stage.at)}</p>
      ) : null}
      {stage.hint ? (
        <p className="text-xs italic text-muted-foreground">{stage.hint}</p>
      ) : null}
      {stage.details.length > 0 ? (
        <dl className="grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {stage.details.map((d, index) => (
            <div
              key={`${stage.key}-detail-${index}`}
              className="rounded-md border bg-muted/40 px-2.5 py-2"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d.label}
              </dt>
              <dd className="mt-0.5 break-all text-xs font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {showBalancePanel ? (
        <BalanceGroupsPanel groups={stage.balanceGroups ?? []} />
      ) : null}
      <Link
        href={activityLink({
          address: stage.logQuery.walletAddress,
          network: stage.logQuery.network ?? stage.logQuery.search,
          tab: stage.logQuery.tab ?? "all",
          type: stage.logQuery.type ?? stage.logQuery.module ?? stage.logQuery.action,
        })}
        className="inline-flex text-xs font-semibold text-primary hover:underline"
      >
        View full logs →
      </Link>
    </div>
  );
}

function VerticalConnector({ tall = false }: { tall?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center", tall ? "py-3" : "py-2")} aria-hidden>
      <div
        className={cn(
          "w-px border-l-2 border-dashed border-muted-foreground/40",
          tall ? "h-10" : "h-6"
        )}
      />
      <div className="size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-muted-foreground/40" />
    </div>
  );
}

function FlowNode({
  stage,
  widthPercent = 100,
  compact = false,
}: {
  stage: FlowchartStage;
  widthPercent?: number;
  compact?: boolean;
}) {
  const Icon = ICONS[stage.icon];

  return (
    <div className="flex w-full flex-col items-center">
      <Tooltip>
        <TooltipTrigger
          type="button"
          style={{
            width: `${widthPercent}%`,
            minWidth: compact ? "100%" : "280px",
            maxWidth: compact ? "100%" : "420px",
          }}
          className={cn(
            "group relative overflow-hidden rounded-xl px-5 py-4 text-left text-white shadow-lg ring-2 transition-all duration-200",
            `bg-gradient-to-br ${stage.gradient}`,
            stage.ring,
            "hover:scale-[1.02] hover:shadow-xl hover:ring-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
            stage.status === "skipped" && "opacity-70"
          )}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
                {stage.label}
              </p>
              <p className="mt-1 text-xs text-white/80">
                {stage.hint ?? (stage.at ? formatDate(stage.at) : stage.subtitle)}
              </p>
              <span
                className={cn(
                  "mt-3 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  badgeClass(stage)
                )}
              >
                {stage.badgeLabel}
              </span>
            </div>
          </div>
          {stage.status === "active" ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
              <div className="h-full w-1/2 animate-pulse bg-white/70" />
            </div>
          ) : null}
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          className={cn(
            "border bg-popover p-3 shadow-lg",
            stage.key === "wallet_linked" ? "max-w-xl" : "max-w-lg"
          )}
          sideOffset={8}
        >
          <StageHoverContent stage={stage} />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function BranchSplitRail() {
  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-2" aria-hidden>
      <div className="mx-auto h-px w-full max-w-md bg-border" />
      <div className="mt-0 grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-6 w-px border-l-2 border-dashed border-muted-foreground/40" />
            <div className="size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-muted-foreground/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetBranchColumn({ branch }: { branch: AssetBranchSlot }) {
  const branchAccent =
    branch.id === "usdt"
      ? "border-orange-500/30 bg-orange-500/5"
      : branch.id === "usdc"
        ? "border-blue-500/30 bg-blue-500/5"
        : "border-emerald-500/30 bg-emerald-500/5";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-2xl border p-4 md:p-5",
        branchAccent,
        !branch.asset && "opacity-60"
      )}
    >
      <div className="mb-4 text-center">
        <p className="text-sm font-bold uppercase tracking-wide">{branch.title}</p>
        <p className="text-xs text-muted-foreground">
          {branch.network ? branch.network.toUpperCase() : "Not detected"}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1">
        {branch.stages.map((stage, i) => {
          const nodeKey = `branch:${branch.id}:${stage.key}`;
          const widths = [100, 92, 84, 76, 68];
          return (
            <div key={nodeKey} className="flex w-full flex-col items-center">
              <FlowNode stage={stage} widthPercent={widths[i] ?? 68} compact />
              {i < branch.stages.length - 1 ? <VerticalConnector /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetadataBar({
  metadata,
  profileHref,
}: {
  metadata: ReturnType<typeof buildFlowchartMetadata>;
  profileHref: string;
}) {
  const items = [
    { label: "Networks approved", value: metadata.networksApproved },
    { label: "Wallet type", value: metadata.walletType },
    { label: "Balances fetched", value: metadata.balancesFetched },
    { label: "Assets detected", value: metadata.assetsDetected },
  ];

  return (
    <div className="mt-8 flex flex-col gap-4 rounded-xl border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-0.5 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>
      <Link href={profileHref} className="shrink-0 text-sm font-medium text-primary hover:underline">
        View wallet & balance details →
      </Link>
    </div>
  );
}

export function PipelineFlowchartSection({
  pipeline,
}: {
  pipeline: UserPipelineSnapshot;
}) {
  const layout = useMemo(() => buildVerticalFlowchartLayout(pipeline), [pipeline]);
  const metadata = buildFlowchartMetadata(pipeline);
  const profileHref = `/users/${encodeURIComponent(pipeline.address)}`;
  const headerWidths = [100, 88];

  return (
    <TooltipProvider delay={0}>
      <div className="py-4">
        <div className="mx-auto flex max-w-lg flex-col items-center">
          {layout.headerStages.map((stage, i) => {
            const nodeKey = `header:${stage.key}`;
            return (
              <div key={nodeKey} className="flex w-full flex-col items-center">
                <FlowNode stage={stage} widthPercent={headerWidths[i] ?? 88} />
                <VerticalConnector tall />
              </div>
            );
          })}
        </div>

        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Asset pipelines
        </p>

        <BranchSplitRail />

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
          {layout.branches.map((branch) => (
            <AssetBranchColumn key={branch.id} branch={branch} />
          ))}
        </div>

        <MetadataBar metadata={metadata} profileHref={profileHref} />
      </div>
    </TooltipProvider>
  );
}
