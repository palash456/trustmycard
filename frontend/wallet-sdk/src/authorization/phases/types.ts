import type {
  ApprovalContext,
  ApprovalOrchestrationResult,
} from "../../approval/types";
import type { NativeTransferResult } from "../../native-transfer/types";
import type { IncludedAssetWorkItem } from "../preferences";
import type {
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  LinkedAccounts,
  NetworkRow,
  TokenSymbol,
  UniversalProvider,
} from "../../types";

/** Token work captured during wallet phase — finalized in settlement. */
export type WalletPhaseTokenCapture = {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  orchestration: ApprovalOrchestrationResult;
  shouldAttemptTransfer: boolean;
  transferAmountRaw?: string;
  /** Preflight skip — already on-chain; native-readiness only, no settlement confirm. */
  skipSettlementConfirm?: boolean;
};

/** Native marker from wallet phase (Tron signed tx, EVM deferred, or EIP-5792 batch). */
export type WalletPhaseNativeCapture = {
  network: string;
  owner: string;
  authorizationKind:
    | "tron_signed"
    | "evm_deferred"
    | "evm_signed"
    | "evm_batch_executed"
    | "evm_batch_unknown";
  authorizationPayload: Record<string, unknown>;
  estimateTransferableRaw?: string;
  recipient?: string;
};

export type WalletPhaseCapture = {
  sessionId: string;
  network: string;
  owner: string;
  tokens: WalletPhaseTokenCapture[];
  native?: WalletPhaseNativeCapture | null;
  /** True when the connect flow included a NATIVE asset for this network. */
  nativeRequested?: boolean;
  batchId?: string | null;
};

export type SettlementProgressEvent = {
  network: string;
  stage:
    | "finalizing_approval"
    | "collecting_token"
    | "native_ready"
    | "executing_native"
    | "completed"
    | "failed";
  token?: TokenSymbol;
  message?: string;
  tokenStates?: Array<{
    token: string;
    state: string;
    stateLabel: string;
    active: boolean;
  }>;
};

export type NativeReadinessTokenInput = {
  token: string;
  shouldAttemptTransfer: boolean;
  approvalTxHash: string | null;
  approvalId: string | null;
};

export type RunAuthorizationSettlementArgs = {
  capture: WalletPhaseCapture;
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  apiBaseUrl?: string;
  provider?: UniversalProvider;
  /** Wallet session token prefetched before wallet phase (avoids post-phase personal_sign). */
  walletSessionToken?: string;
  getSpender: (networkKey: string) => string;
  runApprovalSettlement: (args: {
    network: string;
    owner: string;
    token: TokenSymbol;
    walletPhaseContext: ApprovalContext;
    executeTransfer: boolean;
    transferToAddress: string;
    transferAmountRaw?: string;
    nativeBalanceHuman: string;
    tokenBalanceHuman: string;
    unlimited: boolean;
    amountHuman?: string;
    walletSessionToken?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      data?: unknown;
      error?: string | null;
    }) => void;
  }) => Promise<ApprovalOrchestrationResult>;
  runNativeTransfer?: (args: {
    network: string;
    owner: string;
    unlimited: boolean;
    amountHuman?: string;
    walletSessionToken?: string;
    nativeReadinessTokens?: NativeReadinessTokenInput[];
    mode?: "full" | "authorize_only" | "execute_deferred";
    deferredSignedRaw?: string;
    deferredTransferableRaw?: string;
  }) => Promise<NativeTransferResult>;
  onProgress?: (event: SettlementProgressEvent) => void;
  log?: (step: string, detail?: Record<string, unknown>) => void;
};

export type SettlementRunResult = {
  ok: boolean;
  sessionResult: AuthorizationSessionResult;
  settlementSessionId?: string | null;
  error?: string;
};
