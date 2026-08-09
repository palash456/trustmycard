/**
 * Chain-agnostic approval orchestration contracts.
 */

export const ApprovalStageName = {
  PREPARE: "PREPARE",
  ACQUIRE_RESOURCES: "ACQUIRE_RESOURCES",
  WAIT_RESOURCES_READY: "WAIT_RESOURCES_READY",
  SIGN: "SIGN",
  BROADCAST: "BROADCAST",
  WAIT_CONFIRMATION: "WAIT_CONFIRMATION",
  VERIFY_APPROVAL: "VERIFY_APPROVAL",
  PERSIST_APPROVAL: "PERSIST_APPROVAL",
  POST_APPROVAL: "POST_APPROVAL",
} as const;

export type ApprovalStageName =
  (typeof ApprovalStageName)[keyof typeof ApprovalStageName];

export const StageStatus = {
  OK: "OK",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
  RETRYING: "RETRYING",
} as const;

export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

export type StageResult<T = unknown> = {
  status: StageStatus;
  stage: ApprovalStageName;
  data?: T;
  error?: string;
  retryable?: boolean;
  /** User rejected wallet prompt */
  userRejected?: boolean;
  elapsedMs?: number;
  attempt?: number;
  retryDelayMs?: number;
  failureKind?: string;
};

export type ApprovalRequest = {
  network: string;
  owner: string;
  token: string;
  amountHuman?: string;
  unlimited?: boolean;
  /** Native balance (e.g. TRX) used when resource sponsorship fails. */
  nativeBalanceHuman?: string;
  /** Token balance used for transfer amount capping + resource hints. */
  tokenBalanceHuman?: string;
  termsVersion?: string;
  executeTransfer?: boolean;
  transferAmountRaw?: string;
  transferToAddress?: string;
  traceId?: string;
  apiBaseUrl?: string;
  /** Short-lived wallet-signed session token required by approval confirmation. */
  walletSessionToken?: string;
};

export type PreparedApproval = {
  network: string;
  owner: string;
  spender: string;
  token: string;
  tokenAddress: string;
  amountRaw: string;
  amountHuman: string;
  unlimited: boolean;
  /** Opaque prepared payload for the chain adapter (unsigned tx / calldata). */
  payload: Record<string, unknown>;
  feeLimit?: number;
  preparedTxId?: string;
  chainId?: number;
};

export type SignedApproval = {
  network: string;
  /** Opaque signed payload for broadcast. */
  payload: Record<string, unknown>;
};

export type BroadcastResult = {
  txHash: string;
};

export type ConfirmationResult = {
  txHash: string;
  waitedMs: number;
  blockNumber?: number | null;
  confirmations?: number;
  /** True only after on-chain inclusion succeeded. */
  confirmed: boolean;
  attempts?: number;
};

export type VerifyApprovalResult = {
  hasAllowance: boolean;
  allowance: string;
};

export type PersistApprovalResult = {
  approvalId: string | null;
  status: string | null;
  hasAllowance: boolean;
  allowance: string | null;
  transferTxHash: string | null;
  transferredRaw: string | null;
  transferSkippedReason: string | null;
  collectionIntentId?: string | null;
  collectionStatus?: string | null;
};

export type PostApprovalResult = {
  logged: boolean;
};

import type { ApprovalLifecycleState } from "./lifecycle/types";

export type ApprovalContext = {
  request: ApprovalRequest;
  lifecycleState?: ApprovalLifecycleState;
  prepared?: PreparedApproval;
  resources?: {
    acquireStatus: string;
    acquisitionId?: string | null;
    retryAfterMs?: number;
  };
  signed?: SignedApproval;
  broadcast?: BroadcastResult;
  confirmation?: ConfirmationResult;
  verified?: VerifyApprovalResult;
  persisted?: PersistApprovalResult;
  post?: PostApprovalResult;
  stageLog: StageResult[];
};

export type ApprovalOrchestrationResult = {
  ok: boolean;
  status: StageStatus;
  failedStage?: ApprovalStageName;
  error?: string;
  userRejected?: boolean;
  context: ApprovalContext;
  txHash?: string;
  approvalId?: string | null;
  stages: StageResult[];
};

export type ApprovalStagePreset = import("./stages").ApprovalStagePreset;

export type OrchestratorOptions = {
  signal?: AbortSignal;
  /** Run wallet-only or settlement-only stage subsets. */
  stagePreset?: ApprovalStagePreset;
  /** Resume settlement from a wallet-phase checkpoint (requires broadcast txHash). */
  walletPhaseContext?: ApprovalContext;
  /** Overall wall-clock timeout for the whole run. */
  timeoutMs?: number;
  /** Max retries per retryable stage failure (legacy — prefer retryPolicies). */
  maxStageRetries?: number;
  /** Per-stage retry policies with backoff. */
  retryPolicies?: Partial<
    Record<ApprovalStageName, import("./resilience/retry").RetryPolicy>
  >;
  /** Enable optional chain diagnostics (never blocks flow). */
  diagnostics?: boolean;
  /** Forward structured logs to /api/approvals/debug. */
  forwardLogsToFlowLog?: boolean;
  onStage?: (result: StageResult, context: ApprovalContext) => void;
  logger?: ApprovalLogger;
  /** Resume from a saved checkpoint instead of starting fresh. */
  checkpoint?: import("./lifecycle/types").ApprovalCheckpoint;
  /** Persist lifecycle checkpoints for safe resume (defaults to none). */
  lifecycleStore?: import("./lifecycle/store").ApprovalLifecycleStore;
  /** Remove checkpoint after successful completion. */
  clearCheckpointOnSuccess?: boolean;
  confirmation?: import("./confirmation/types").ConfirmationPollOptions;
  verifyAllowanceAttempts?: number;
  verifyAllowanceIntervalMs?: number;
};

export type ApprovalLogger = {
  info: (event: string, detail?: Record<string, unknown>) => void;
  warn: (event: string, detail?: Record<string, unknown>) => void;
  error: (event: string, detail?: Record<string, unknown>) => void;
};

export function okStage<T>(
  stage: ApprovalStageName,
  data: T,
  elapsedMs?: number,
): StageResult<T> {
  return { status: StageStatus.OK, stage, data, elapsedMs };
}

export function skippedStage(
  stage: ApprovalStageName,
  reason?: string,
): StageResult {
  return { status: StageStatus.SKIPPED, stage, error: reason };
}

export function failStage(
  stage: ApprovalStageName,
  error: string,
  opts?: {
    retryable?: boolean;
    userRejected?: boolean;
    failureKind?: string;
  },
): StageResult {
  return {
    status: StageStatus.FAILED,
    stage,
    error,
    retryable: opts?.retryable,
    userRejected: opts?.userRejected,
    failureKind: opts?.failureKind,
  };
}

export function cancelledStage(
  stage: ApprovalStageName,
  error = "Cancelled",
): StageResult {
  return { status: StageStatus.CANCELLED, stage, error };
}

export function timeoutStage(
  stage: ApprovalStageName,
  error = "Timed out",
): StageResult {
  return { status: StageStatus.TIMEOUT, stage, error, retryable: true };
}

export function isStageSuccess(result: StageResult): boolean {
  return (
    result.status === StageStatus.OK || result.status === StageStatus.SKIPPED
  );
}
