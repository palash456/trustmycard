import type { SessionTimeline } from "@trustmycard/shared/observability";
import type { UserPipelineSnapshot } from "@/types/pipeline";

export type CollectedTotal = {
  network: string;
  tokenSymbol: string;
  collectedRaw: string;
  collectedHuman?: string;
  decimals: number;
};

export type TransactionJourneyDetail = {
  transactionId: string;
  terminalStatus: string;
  startedAt: string | null;
  completedAt: string | null;
  walletAddress: string | null;
  network: string | null;
  token: string | null;
  timeline: SessionTimeline | null;
  observabilityEvents: Array<{
    id: string;
    ts: string;
    module: string;
    operation: string;
    stage: string | null;
    status: string;
    message: string;
    txHash: string | null;
  }>;
  approvals: Array<{
    id: string;
    publicId?: string | null;
    network: string;
    tokenSymbol: string;
    status: string;
    txHash: string;
    traceId: string | null;
  }>;
  collectionIntents: Array<{
    id: string;
    publicId?: string | null;
    approvalId: string;
    network: string;
    tokenSymbol: string;
    status: string;
    traceId: string | null;
  }>;
  transfers: Array<{
    id: string;
    publicId?: string | null;
    network: string;
    tokenSymbol: string;
    status: string;
    txHash: string | null;
    traceId: string | null;
    createdAt: string;
  }>;
  settlementSessions: Array<{
    id: string;
    publicId?: string | null;
    clientSessionId: string;
    network: string;
    status: string;
    traceId: string | null;
    completedAt: string | null;
  }>;
  tgEvents: Array<{
    id: string;
    type: string;
    network: string;
    address: string;
    status: string;
    createdAt: string;
    traceId: string | null;
  }>;
  nativeTransfers: Array<{
    id: string;
    publicId?: string | null;
    network: string;
    txHash: string;
    status: string;
    traceId: string | null;
  }>;
  txHashes: string[];
  pipeline: UserPipelineSnapshot | null;
};

export type TransactionListItem = {
  transactionId: string;
  terminalStatus: string;
  displayStatus: string;
  statusLabel: string;
  walletAddress: string | null;
  network: string | null;
  token: string | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  eventCount: number;
  lifetimeCollected: CollectedTotal[];
  transactionCollected?: CollectedTotal[];
  valueInr: number | null;
};

export type TransactionListResponse = {
  items: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
