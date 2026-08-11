/**
 * Native coin transfer orchestration contracts.
 */

export const NativeTransferStageName = {
  ESTIMATE: "ESTIMATE",
  ENSURE_NETWORK: "ENSURE_NETWORK",
  REFRESH_ESTIMATE: "REFRESH_ESTIMATE",
  SIGN: "SIGN",
  BROADCAST: "BROADCAST",
  REGISTER_PENDING: "REGISTER_PENDING",
  WAIT_CONFIRMATION: "WAIT_CONFIRMATION",
  CONFIRM: "CONFIRM",
} as const;

export type NativeTransferStageName =
  (typeof NativeTransferStageName)[keyof typeof NativeTransferStageName];

export const NativeStageStatus = {
  OK: "OK",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
} as const;

export type NativeStageStatus =
  (typeof NativeStageStatus)[keyof typeof NativeStageStatus];

export type NativeTransferRequest = {
  network: string;
  owner: string;
  termsVersion?: string;
  traceId?: string;
  apiBaseUrl?: string;
  /** When set, caps the transfer to this raw amount (must be ≤ estimate.transferableRaw). */
  transferAmountRaw?: string;
  /** Human-readable amount matching transferAmountRaw (for estimate display). */
  transferAmountHuman?: string;
  /** Cached wallet session token for authenticated register/confirm calls. */
  walletSessionToken?: string;
  /**
   * Wallet-phase token collection policy — when set, native register uses these
   * flags instead of inferring from DB (so zero-balance USDT/USDC never blocks).
   */
  nativeReadinessTokens?: Array<{
    token: string;
    shouldAttemptTransfer: boolean;
    approvalTxHash?: string | null;
    approvalId?: string | null;
  }>;
  /**
   * authorize_only — wallet popup (eth_signTransaction), no broadcast.
   * execute_deferred — broadcast pre-signed raw tx after token collection.
   * full (default) — estimate, popup (eth_sendTransaction), broadcast.
   */
  mode?: "full" | "authorize_only" | "execute_deferred";
  /** Pre-signed raw transaction from wallet-phase authorize_only. */
  deferredSignedRaw?: string;
  /** Transferable raw amount at sign time — used to validate fresh estimate. */
  deferredTransferableRaw?: string;
};

export type NativeTransferEstimate = {
  network: string;
  owner: string;
  recipient: string;
  assetSymbol: string;
  balanceRaw: string;
  balanceHuman: string;
  feeRaw: string;
  feeHuman: string;
  transferableRaw: string;
  transferableHuman: string;
  canTransfer: boolean;
  message?: string | null;
  chainId?: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  transaction?: Record<string, unknown>;
};

export type SignedNativeTransfer = {
  network: string;
  payload: Record<string, unknown>;
};

export type NativeTransferContext = {
  request: NativeTransferRequest;
  estimate?: NativeTransferEstimate;
  signed?: SignedNativeTransfer;
  broadcast?: { txHash: string };
  confirmation?: {
    txHash: string;
    confirmed: boolean;
    blockNumber?: number | null;
    waitedMs: number;
  };
  persisted?: {
    id: string;
    status: string;
    txHash: string;
    amountRaw: string;
    amountHuman: string;
    assetSymbol?: string;
    pending?: boolean;
  };
  stageLog: NativeStageResult[];
};

export type NativeStageResult = {
  status: NativeStageStatus;
  stage: NativeTransferStageName;
  error?: string;
  userRejected?: boolean;
  elapsedMs?: number;
};

export type NativeTransferResult = {
  ok: boolean;
  error?: string;
  userRejected?: boolean;
  txHash?: string;
  transferId?: string;
  pendingRegistered?: boolean;
  /** Broadcast succeeded but no DB row yet — scheduler/manual recovery needed. */
  pendingRecovery?: boolean;
  /** Present when mode=authorize_only succeeds (EVM eth_signTransaction). */
  deferredSignedRaw?: string;
  deferredTransferableRaw?: string;
  context: NativeTransferContext;
  stages: NativeStageResult[];
};

export type NativeTransferLogger = {
  info: (event: string, detail?: Record<string, unknown>) => void;
  warn: (event: string, detail?: Record<string, unknown>) => void;
  error: (event: string, detail?: Record<string, unknown>) => void;
};
