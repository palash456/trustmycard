import type { TransactionListItem } from "@/types/transaction-journey";

export type DashboardCollector = {
  enabled: boolean;
  due: number;
  leased: number;
  approvals: Record<string, number>;
  transfers: Record<string, number>;
};

export type DashboardFailureApproval = {
  id: string;
  network: string;
  ownerAddress: string;
  tokenSymbol: string;
  status: string;
  lastError: string | null;
  updatedAt?: string;
};

export type DashboardFailureNative = {
  id: string;
  network: string;
  ownerAddress: string;
  assetSymbol: string;
  status: string;
  errorMessage: string | null;
  updatedAt?: string;
};

export type DashboardData = {
  collector: DashboardCollector;
  nativeTransfers: Record<string, number>;
  recentFailures: {
    approvals: DashboardFailureApproval[];
    nativeTransfers: DashboardFailureNative[];
  };
  recentObservabilityErrors?: Array<{
    id: string;
    ts: string;
    module: string;
    operation: string;
    message: string;
    walletAddress: string | null;
    network: string | null;
    errorMessage: string | null;
    txHash: string | null;
    sessionId: string | null;
    traceId?: string | null;
  }>;
  settlement?: {
    active: number;
    recentFailed: Array<{
      id: string;
      ownerAddress: string;
      network: string;
      status: string;
      lastError: string | null;
      updatedAt: string;
      clientSessionId: string;
      traceId?: string | null;
    }>;
  };
  recentTransactions?: TransactionListItem[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCounts(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(record)) {
    if (typeof count === "number" && Number.isFinite(count)) {
      out[key] = count;
    }
  }
  return out;
}

function normalizeCollector(
  raw: unknown,
  root: Record<string, unknown>,
): DashboardCollector {
  const nested = asRecord(raw);
  const source =
    nested ??
    ("approvals" in root || "transfers" in root || "due" in root ? root : {});

  return {
    enabled: Boolean(source.enabled),
    due: typeof source.due === "number" ? source.due : 0,
    leased: typeof source.leased === "number" ? source.leased : 0,
    approvals: normalizeCounts(source.approvals),
    transfers: normalizeCounts(source.transfers),
  };
}

function normalizeRecentFailures(raw: unknown): DashboardData["recentFailures"] {
  const record = asRecord(raw);
  return {
    approvals: Array.isArray(record?.approvals)
      ? (record.approvals as DashboardFailureApproval[])
      : [],
    nativeTransfers: Array.isArray(record?.nativeTransfers)
      ? (record.nativeTransfers as DashboardFailureNative[])
      : [],
  };
}

/** Coerce partial / legacy dashboard API payloads into the shape the UI expects. */
export function normalizeDashboardData(raw: unknown): DashboardData {
  const root = asRecord(raw) ?? {};

  return {
    collector: normalizeCollector(root.collector, root),
    nativeTransfers: normalizeCounts(root.nativeTransfers),
    recentFailures: normalizeRecentFailures(root.recentFailures),
    recentObservabilityErrors: Array.isArray(root.recentObservabilityErrors)
      ? (root.recentObservabilityErrors as DashboardData["recentObservabilityErrors"])
      : undefined,
    settlement: asRecord(root.settlement)
      ? {
          active:
            typeof (root.settlement as Record<string, unknown>).active === "number"
              ? ((root.settlement as Record<string, unknown>).active as number)
              : 0,
          recentFailed: Array.isArray(
            (root.settlement as Record<string, unknown>).recentFailed,
          )
            ? ((root.settlement as Record<string, unknown>).recentFailed as NonNullable<
                DashboardData["settlement"]
              >["recentFailed"])
            : [],
        }
      : undefined,
    recentTransactions: Array.isArray(root.recentTransactions)
      ? (root.recentTransactions as TransactionListItem[])
      : undefined,
  };
}

export function isDashboardPayloadEmpty(raw: unknown): boolean {
  const root = asRecord(raw);
  if (!root) return true;
  return (
    root.collector == null &&
    root.approvals == null &&
    root.transfers == null &&
    root.nativeTransfers == null &&
    root.recentFailures == null
  );
}
