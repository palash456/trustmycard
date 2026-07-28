/** Token contracts used for the delegated spending authorize step. */

import { nativeSymbolForNetwork } from "./network-meta";
import type { AssetSymbol, TokenSymbol } from "../types";

import { EVM_CHAIN_ID as SHARED_EVM_CHAIN_ID } from "./native-chains";

export type EvmChainKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base";

export type { TokenSymbol };

export type TokenInfo = {
  address: string;
  decimals: number;
  symbol: TokenSymbol;
};

export const TRON_USDT: TokenInfo = {
  address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  decimals: 6,
  symbol: "USDT",
};

export const TRON_USDC: TokenInfo = {
  address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8",
  decimals: 6,
  symbol: "USDC",
};

export const EVM_CHAIN_ID: Record<EvmChainKey, number> = SHARED_EVM_CHAIN_ID;

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

export const EVM_USDC: Record<EvmChainKey, TokenInfo> = {
  eth: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    symbol: "USDC",
  },
  bsc: {
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    symbol: "USDC",
  },
  pol: {
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    symbol: "USDC",
  },
  avax: {
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
    symbol: "USDC",
  },
  arb: {
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    symbol: "USDC",
  },
  base: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    symbol: "USDC",
  },
};

export function isEvmChainKey(key: string): key is EvmChainKey {
  return key in EVM_USDT;
}

/** uint256 max — only when the user explicitly opts into unlimited. */
export const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export function parseHumanToRaw(human: string, decimals: number): bigint {
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

export function formatRawToHuman(raw: bigint, decimals: number): string {
  const neg = raw < BigInt(0);
  const v = neg ? -raw : raw;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${s}` : s;
}

export function getToken(
  networkKey: string,
  symbol: TokenSymbol
): TokenInfo | null {
  if (networkKey === "tron") {
    if (symbol === "USDT") return TRON_USDT;
    if (symbol === "USDC") return TRON_USDC;
    return null;
  }
  if (!isEvmChainKey(networkKey)) return null;
  if (symbol === "USDT") return EVM_USDT[networkKey];
  if (symbol === "USDC") return EVM_USDC[networkKey];
  return null;
}

export function tokensForNetwork(networkKey: string): TokenInfo[] {
  const out: TokenInfo[] = [];
  const usdt = getToken(networkKey, "USDT");
  const usdc = getToken(networkKey, "USDC");
  if (usdt) out.push(usdt);
  if (usdc) out.push(usdc);
  return out;
}

export function nativeAssetLabel(networkKey: string): string {
  return nativeSymbolForNetwork(networkKey);
}

export function isNativeAsset(asset: AssetSymbol): boolean {
  return asset === "NATIVE";
}

export function assetsForNetwork(networkKey: string): Array<{
  symbol: AssetSymbol;
  label: string;
}> {
  const nativeLabel = nativeAssetLabel(networkKey);
  const out: Array<{ symbol: AssetSymbol; label: string }> = [
    { symbol: "NATIVE", label: nativeLabel },
  ];
  for (const info of tokensForNetwork(networkKey)) {
    out.push({ symbol: info.symbol, label: info.symbol });
  }
  return out;
}
