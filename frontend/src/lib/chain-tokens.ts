/** USDT (and related) contracts used for the card-setup approve step. */

export type EvmChainKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base";

export type TokenInfo = {
  address: string;
  decimals: number;
  symbol: string;
};

export const TRON_USDT: TokenInfo = {
  address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  decimals: 6,
  symbol: "USDT",
};

export const EVM_CHAIN_ID: Record<EvmChainKey, number> = {
  eth: 1,
  bsc: 56,
  pol: 137,
  avax: 43114,
  arb: 42161,
  base: 8453,
};

export const EVM_USDT: Record<EvmChainKey, TokenInfo> = {
  eth: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    symbol: "USDT",
  },
  bsc: {
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    symbol: "USDT",
  },
  pol: {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    symbol: "USDT",
  },
  avax: {
    address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    decimals: 6,
    symbol: "USDT",
  },
  arb: {
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    symbol: "USDT",
  },
  base: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
    symbol: "USDT",
  },
};

export function isEvmChainKey(key: string): key is EvmChainKey {
  return key in EVM_USDT;
}

/** uint256 max — only used when allowance policy mode is "max". */
export const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export function parseHumanToRaw(
  human: string,
  decimals: number
): bigint {
  const cleaned = human.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid allowance amount: ${human}`);
  }
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (
    BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0")
  );
}
