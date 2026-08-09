import type { ApprovalContext, ApprovalOrchestrationResult } from "../../approval/types";
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
};

/** Native marker from wallet phase (Tron signed tx, EVM deferred, or EIP-5792 batch). */
export type WalletPhaseNativeCapture = {
  network: string;
  owner: string;
  authorizationKind: "tron_signed" | "evm_deferred" | "evm_batch_executed";
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

export type RunAuthorizationSettlementArgs = {
  capture: WalletPhaseCapture;
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  apiBaseUrl?: string;
  provider?: UniversalProvider;
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
  }) => Promise<ApprovalOrchestrationResult>;
  runNativeTransfer?: (args: {
    network: string;
    owner: string;
    unlimited: boolean;
    amountHuman?: string;
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
