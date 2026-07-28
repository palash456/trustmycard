export type TokenBalances = {
  native: string;
  usdt: string;
  usdc?: string;
};

export type BalancesResponse = Record<string, TokenBalances>;

export type EvmChainConfig = {
  key: string;
  rpc: string[];
  nativeDecimals: number;
  usdt?: { address: string; decimals: number };
  usdc?: { address: string; decimals: number };
};

export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
