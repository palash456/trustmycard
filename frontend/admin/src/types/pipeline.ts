export type PipelineStageStatus =
  "waiting" | "running" | "success" | "failed" | "retried" | "skipped";

export type PipelineWorkflowStage =
  | "idle"
  | "connected"
  | "approving"
  | "approved"
  | "settling"
  | "collecting"
  | "completed"
  | "native_pending"
  | "failed";

export type PipelineHealthStatus = "healthy" | "warning" | "error" | "idle";

export type PipelineUserSummary = {
  workflowStage: PipelineWorkflowStage;
  healthStatus: PipelineHealthStatus;
  firstSeen: string | null;
  lastActivity: string | null;
  networksUsed: string[];
  approvedChains: string[];
  isComplete: boolean;
};

export type LogLinkParams = {
  walletAddress?: string;
  txHash?: string;
  module?: string;
  action?: string;
  search?: string;
  entityType?: string;
  tab?: string;
  type?: string;
  sessionId?: string;
  traceId?: string;
  transactionId?: string;
  network?: string;
};

export type PipelineStage = {
  key: string;
  label: string;
  status: PipelineStageStatus;
  at?: string;
  metadata: Record<string, unknown>;
  logQuery: LogLinkParams;
};

export type PipelineAttempt = {
  id: string;
  attemptNumber: number;
  status: PipelineStageStatus;
  at: string;
  txHash?: string | null;
  error?: string | null;
  metadata: Record<string, unknown>;
};

export type AssetPipeline = {
  key: string;
  kind: "token" | "native";
  network: string;
  symbol: string;
  currentStage: string;
  stages: PipelineStage[];
  attempts: PipelineAttempt[];
};

export type PipelineMetrics = {
  requested: number;
  approved: number;
  transfersSuccessful: number;
  transfersAwaiting: number;
  transfersFailed: number;
  retries: number;
  repaired: number;
  pendingConfirmations: number;
  onChainVerified: number;
  pipelinesCompleted: number;
  averageProcessingMs: number | null;
  successRate: number;
  perAsset: Record<
    string,
    { requested: number; successful: number; failed: number; awaiting: number }
  >;
};

export type WalletLinkedStage = {
  status: PipelineStageStatus;
  at?: string;
  metadata: Record<string, unknown>;
  logQuery: LogLinkParams;
};

export type NetworkApprovedEntry = {
  network: string;
  status: PipelineStageStatus;
  approvalStatus?: string;
  metadata: Record<string, unknown>;
  logQuery: LogLinkParams;
};

export type PipelineSettlementSession = {
  id: string;
  network: string;
  status: string;
  statusLabel: string;
  usdtSettled: boolean;
  usdcSettled: boolean;
  nativeReady: boolean;
  lastError: string | null;
  clientSessionId: string;
  updatedAt: string;
  completedAt: string | null;
};

export type UserPipelineSnapshot = {
  address: string;
  username?: string | null;
  publicId?: string | null;
  generatedAt: string;
  summary: PipelineUserSummary;
  walletLinked: WalletLinkedStage;
  networkApproved: { networks: NetworkApprovedEntry[] };
  settlementSessions?: PipelineSettlementSession[];
  assets: AssetPipeline[];
  metrics: PipelineMetrics;
};

export function pipelineStageStatusLabel(status: PipelineStageStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "running":
      return "Running";
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "retried":
      return "Retried";
    case "skipped":
      return "Skipped";
  }
}
