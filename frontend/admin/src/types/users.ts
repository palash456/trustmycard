export type WorkflowStage =
  | "idle"
  | "connected"
  | "approving"
  | "approved"
  | "collecting"
  | "completed"
  | "native_pending"
  | "failed";

export type HealthStatus = "healthy" | "warning" | "error" | "idle";

export type CollectableItem = {
  network: string;
  tokenSymbol: string;
  remainingRaw: string;
  remainingHuman?: string;
  decimals: number;
};

export type CollectedTotal = {
  network: string;
  tokenSymbol: string;
  collectedRaw: string;
  collectedHuman?: string;
  decimals: number;
};

export type UserListRow = {
  address: string;
  firstSeen: string | null;
  lastActivity: string | null;
  networksUsed: string[];
  approvedChains: string[];
  activeChain: string | null;
  workflowStage: WorkflowStage;
  approvalStatus: string | null;
  collectionStatus: string | null;
  transferStatus: string | null;
  nativeFundingStatus: string | null;
  reconciliationStatus: string | null;
  collectableRemaining: CollectableItem[];
  totalLifetimeCollected: CollectedTotal[];
  approvalCount: number;
  transferCount: number;
  nativeTransferCount: number;
  eventCount: number;
  latestTransaction: { txHash: string; at: string; source: string } | null;
  latestActivity: { at: string; type: string; label: string } | null;
  latestError: string | null;
  healthStatus: HealthStatus;
};

export type UserListResponse = {
  items: UserListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

import type { UnifiedActivityItem } from "./activity-feed";

export type UserTimelineItem = {
  type: string;
  id: string;
  at: string;
  label: string;
  status: string;
  source?: string;
  step?: string;
  error?: string | null;
  network?: string | null;
  sessionId?: string | null;
};

export type UserDetail = {
  address: string;
  summary: UserListRow & {
    lifetimeCollected: CollectedTotal[];
    successRate: number;
  };
  activeApprovals: Array<Record<string, unknown>>;
  revokedApprovals: Array<Record<string, unknown>>;
  approvalHistory: Array<Record<string, unknown>>;
  transfers: Array<Record<string, unknown>>;
  nativeTransfers: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  observabilityEvents?: Array<Record<string, unknown>>;
  sessionTimelines?: Array<Record<string, unknown>>;
  resourceSponsorships: Array<Record<string, unknown>>;
  errors: Array<{ id: string; source: string; message: string; at: string }>;
  retryHistory: Array<{
    id: string;
    type: string;
    count: number;
    lastError: string | null;
    at: string;
  }>;
  analytics: {
    approvalCount: number;
    transferCount: number;
    nativeTransferCount: number;
    eventCount: number;
    confirmedTransfers: number;
    confirmedNative: number;
    failedApprovals: number;
    failedTransfers: number;
    failedNative: number;
    successRate: number;
  };
  timeline: UserTimelineItem[];
  activityFeed?: UnifiedActivityItem[];
  activityFeedTotal?: number;
  balancesHint: { evmAddress: string | null; tronAddress: string | null };
};

export type UserBalances = Record<
  string,
  { native: string; usdt: string; usdc: string }
>;
