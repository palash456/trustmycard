export type UniversalProvider = Awaited<
  ReturnType<
    Awaited<
      typeof import("@walletconnect/universal-provider")
    >["default"]["init"]
  >
>;

export type WalletConnectModal = InstanceType<
  typeof import("@walletconnect/modal").WalletConnectModal
>;

export type WcSession = {
  namespaces?: Record<
    string,
    { accounts?: string[]; methods?: string[] }
  >;
  sessionProperties?: Record<string, string>;
  topic?: string;
};

export type TokenBalances = {
  native: string;
  usdt: string;
  usdc?: string;
};

export type BalancesResponse = Record<string, TokenBalances>;

export type NetworkRow = {
  key: string;
  name: string;
  standard: string;
  color: string;
  letter: string;
  balances: TokenBalances;
};

export type LinkedAccounts = { evm: string | null; tron: string | null };

export type RowStatus =
  | "awaiting"
  | "waiting"
  | "finalizing"
  | "approved"
  | "rejected";

export type TokenSymbol = "USDT" | "USDC";

/** Selectable asset on a network card — native coin or stablecoin. */
export type AssetSymbol = "NATIVE" | TokenSymbol;

/** Session-level mode for the Collection Preferences consent screen. */
export type CollectionMode = "maximum" | "custom";

/** Per-token preference within a network (USDT / USDC). */
export type TokenPreference = {
  included: boolean;
  /** maximum => unlimited approve; custom => amountHuman cap */
  mode: "maximum" | "custom";
  amountHuman: string;
};

export type NetworkTokenPrefs = {
  USDT?: TokenPreference;
  USDC?: TokenPreference;
  NATIVE?: TokenPreference;
};

/** Preferences keyed by network key across all connected networks. */
export type CollectionPreferences = Record<string, NetworkTokenPrefs>;

export type AuthorizationAssetOutcome =
  | "authorized"
  | "user_rejected"
  | "failed"
  | "skipped_unsupported"
  | "skipped_zero"
  | "collected"
  | "pending";

export type AuthorizationAssetResult = {
  network: string;
  token: TokenSymbol | "NATIVE";
  outcome: AuthorizationAssetOutcome;
  message?: string | null;
  approvalId?: string | null;
  collectionIntentId?: string | null;
  collectionStatus?: string | null;
  txHash?: string | null;
  transferSkippedReason?: string | null;
};

export type AuthorizationSessionResult = {
  items: AuthorizationAssetResult[];
  authorizedCount: number;
  failedCount: number;
  rejectedCount: number;
  skippedCount: number;
};

export type ModalStep =
  | "connected"
  | "preferences"
  | "authorizing"
  | "complete";

export type AuthorizingPhase =
  | "preparing"
  | "wallet_confirm"
  | "finalizing";

/** @deprecated Prefer CollectionPreferences — kept for type compatibility. */
export type AuthorizeDraft = {
  networkKey: string;
  asset: AssetSymbol;
  amountHuman: string;
  unlimited: boolean;
  termsAccepted: boolean;
};

export type ApprovalStatus =
  | "DRAFT"
  | "PENDING_SIGNATURE"
  | "SUBMITTED"
  | "ACTIVE"
  | "PARTIALLY_USED"
  | "EXHAUSTED"
  | "REVOKED"
  | "EXPIRED"
  | "FAILED";
