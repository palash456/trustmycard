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
