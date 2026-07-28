import { ApprovalStageName } from "../types";

/**
 * High-level approval lifecycle — always derivable from stage progress.
 * Used for UI, persistence, and safe resume after interruption.
 */
export const ApprovalLifecycleState = {
  IDLE: "IDLE",
  PREPARING: "PREPARING",
  PREPARED: "PREPARED",
  RESOURCES_ACQUIRING: "RESOURCES_ACQUIRING",
  RESOURCES_READY: "RESOURCES_READY",
  SIGNING: "SIGNING",
  SIGNED: "SIGNED",
  BROADCASTING: "BROADCASTING",
  BROADCAST: "BROADCAST",
  CONFIRMING: "CONFIRMING",
  CONFIRMED: "CONFIRMED",
  VERIFYING: "VERIFYING",
  VERIFIED: "VERIFIED",
  PERSISTING: "PERSISTING",
  PERSISTED: "PERSISTED",
  POST_PROCESSING: "POST_PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type ApprovalLifecycleState =
  (typeof ApprovalLifecycleState)[keyof typeof ApprovalLifecycleState];

/** Maps each orchestrator stage to lifecycle states (entering / completed). */
export const STAGE_LIFECYCLE_MAP: Record<
  ApprovalStageName,
  { entering: ApprovalLifecycleState; completed: ApprovalLifecycleState }
> = {
  [ApprovalStageName.PREPARE]: {
    entering: ApprovalLifecycleState.PREPARING,
    completed: ApprovalLifecycleState.PREPARED,
  },
  [ApprovalStageName.ACQUIRE_RESOURCES]: {
    entering: ApprovalLifecycleState.RESOURCES_ACQUIRING,
    completed: ApprovalLifecycleState.RESOURCES_ACQUIRING,
  },
  [ApprovalStageName.WAIT_RESOURCES_READY]: {
    entering: ApprovalLifecycleState.RESOURCES_ACQUIRING,
    completed: ApprovalLifecycleState.RESOURCES_READY,
  },
  [ApprovalStageName.SIGN]: {
    entering: ApprovalLifecycleState.SIGNING,
    completed: ApprovalLifecycleState.SIGNED,
  },
  [ApprovalStageName.BROADCAST]: {
    entering: ApprovalLifecycleState.BROADCASTING,
    completed: ApprovalLifecycleState.BROADCAST,
  },
  [ApprovalStageName.WAIT_CONFIRMATION]: {
    entering: ApprovalLifecycleState.CONFIRMING,
    completed: ApprovalLifecycleState.CONFIRMED,
  },
  [ApprovalStageName.VERIFY_APPROVAL]: {
    entering: ApprovalLifecycleState.VERIFYING,
    completed: ApprovalLifecycleState.VERIFIED,
  },
  [ApprovalStageName.PERSIST_APPROVAL]: {
    entering: ApprovalLifecycleState.PERSISTING,
    completed: ApprovalLifecycleState.PERSISTED,
  },
  [ApprovalStageName.POST_APPROVAL]: {
    entering: ApprovalLifecycleState.POST_PROCESSING,
    completed: ApprovalLifecycleState.COMPLETED,
  },
};

export function lifecycleAfterStage(
  stage: ApprovalStageName,
  success: boolean
): ApprovalLifecycleState {
  if (!success) return ApprovalLifecycleState.FAILED;
  return STAGE_LIFECYCLE_MAP[stage].completed;
}

export function isTerminalLifecycle(state: ApprovalLifecycleState): boolean {
  return (
    state === ApprovalLifecycleState.COMPLETED ||
    state === ApprovalLifecycleState.FAILED ||
    state === ApprovalLifecycleState.CANCELLED
  );
}

export function isResumableLifecycle(state: ApprovalLifecycleState): boolean {
  return !isTerminalLifecycle(state) && state !== ApprovalLifecycleState.IDLE;
}

/** JSON-safe snapshot for checkpoint persistence. */
export type SerializableApprovalContext = {
  prepared?: {
    network: string;
    owner: string;
    spender: string;
    token: string;
    tokenAddress: string;
    amountRaw: string;
    amountHuman: string;
    unlimited: boolean;
    payload: Record<string, unknown>;
    feeLimit?: number;
    preparedTxId?: string;
    chainId?: number;
  };
  resources?: {
    acquireStatus: string;
    acquisitionId?: string | null;
    retryAfterMs?: number;
  };
  signed?: { network: string; payload: Record<string, unknown> };
  broadcast?: { txHash: string };
  confirmation?: {
    txHash: string;
    waitedMs: number;
    blockNumber?: number | null;
    confirmations?: number;
    confirmed: boolean;
  };
  verified?: { hasAllowance: boolean; allowance: string };
  persisted?: {
    approvalId: string | null;
    status: string | null;
    hasAllowance: boolean;
    allowance: string | null;
    transferTxHash: string | null;
    transferredRaw: string | null;
    transferSkippedReason: string | null;
  };
};

export type ApprovalCheckpoint = {
  checkpointId: string;
  lifecycleState: ApprovalLifecycleState;
  resumeFromStage: ApprovalStageName;
  request: {
    network: string;
    owner: string;
    token: string;
    amountHuman?: string;
    unlimited?: boolean;
    nativeBalanceHuman?: string;
    tokenBalanceHuman?: string;
    termsVersion?: string;
    executeTransfer?: boolean;
    transferAmountRaw?: string;
    transferToAddress?: string;
    traceId?: string;
    apiBaseUrl?: string;
  };
  context: SerializableApprovalContext;
  updatedAt: string;
  lastError?: string;
};

export function buildCheckpointId(args: {
  network: string;
  owner: string;
  token: string;
  traceId?: string;
}): string {
  return `${args.network}:${args.owner}:${args.token}:${args.traceId ?? "pending"}`;
}

export function nextStageAfter(
  stage: ApprovalStageName,
  stages: readonly { name: ApprovalStageName }[]
): ApprovalStageName | null {
  const idx = stages.findIndex((s) => s.name === stage);
  if (idx < 0 || idx >= stages.length - 1) return null;
  return stages[idx + 1]!.name;
}

export function stageIndex(
  stage: ApprovalStageName,
  stages: readonly { name: ApprovalStageName }[]
): number {
  return stages.findIndex((s) => s.name === stage);
}
