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
  log?: (step: string, detail?: Record<string, unknown>) => void;
  walletPhaseOnly?: boolean;
};

export type EvmTokenBatchRunResult = {
  results: AuthorizationAssetResult[];
  tokenCaptures: WalletPhaseTokenCapture[];
  batchId?: string | null;
  batchIncludedNative?: boolean;
  nativeTxHash?: string | null;
  nativeTransferableRaw?: string | null;
  nativeRecipient?: string | null;
  batchMode?: "eip5792" | "multicall3" | "sequential" | null;
};
