import type { ApprovalOrchestrationResult } from "../approval/types";
import type {
  AuthorizationAssetResult,
  LinkedAccounts,
  NetworkRow,
  TokenSymbol,
  UniversalProvider,
} from "../types";
import type { IncludedAssetWorkItem } from "./preferences";
import type { WalletPhaseTokenCapture } from "./phases/types";
import type { EvmBatchNativeOutcome } from "./evm-batch-native-outcome";

export type EvmTokenBatchRunArgs = {
  items: IncludedAssetWorkItem[];
  network: string;
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  provider: UniversalProvider;
  apiBaseUrl?: string;
  getSpender: (networkKey: string) => string;
  /** When set, attempt EIP-5792 triple batch (approves + native) in wallet phase. */
  nativeItem?: IncludedAssetWorkItem & { asset: "NATIVE" };
  runApproval: (args: {
    network: string;
    owner: string;
    token: TokenSymbol;
    amountHuman?: string;
    unlimited: boolean;
    nativeBalanceHuman: string;
    tokenBalanceHuman: string;
    executeTransfer: boolean;
    transferToAddress: string;
    transferAmountRaw?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      data?: unknown;
      error?: string | null;
    }) => void;
  }) => Promise<ApprovalOrchestrationResult>;
  onAssetStart?: (item: IncludedAssetWorkItem) => void;
  onAssetEnd?: (result: AuthorizationAssetResult) => void;
  /** EIP-5792 USDT+USDC single popup — one progress stage for the batch. */
  onBatchWalletConfirm?: () => void;
  log?: (step: string, detail?: Record<string, unknown>) => void;
  walletPhaseOnly?: boolean;
  /** Bearer token for authenticated queue-collection when allowance already exists. */
  walletSessionToken?: string;
};

export type EvmTokenBatchRunResult = {
  results: AuthorizationAssetResult[];
  tokenCaptures: WalletPhaseTokenCapture[];
  batchId?: string | null;
  batchIncludedNative?: boolean;
  batchNativeOutcome?: EvmBatchNativeOutcome;
  /** @deprecated Use batchNativeOutcome — kept for legacy inference only */
  nativeIncludedInBatchAttempt?: boolean;
  nativeTxHash?: string | null;
  nativeTransferableRaw?: string | null;
  nativeRecipient?: string | null;
  batchChainId?: number | null;
  batchNativeJobCount?: number | null;
  batchMode?: "eip5792" | "sequential" | null;
};
