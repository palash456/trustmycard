import type { EvmChainConfig } from "./types";

/** Supported card networks — same coverage as the working scan. */
export const EVM_CHAINS: EvmChainConfig[] = [
  {
    key: "eth",
    rpc: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
    nativeDecimals: 18,
    usdt: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    usdc: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
  },
  {
    key: "bsc",
    rpc: ["https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
    nativeDecimals: 18,
    usdt: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    usdc: {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
  },
  {
    key: "pol",
    rpc: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
    nativeDecimals: 18,
    usdt: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
    usdc: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
  },
  {
    key: "avax",
    rpc: [
      "https://avalanche-c-chain.publicnode.com",
      "https://api.avax.network/ext/bc/C/rpc",
    ],
    nativeDecimals: 18,
    usdt: {
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6,
    },
    usdc: {
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
  },
  {
    key: "arb",
    rpc: ["https://arbitrum-one.publicnode.com", "https://1rpc.io/arb"],
    nativeDecimals: 18,
    usdt: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    usdc: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
  },
  {
    key: "base",
    rpc: ["https://base.publicnode.com", "https://1rpc.io/base"],
    nativeDecimals: 18,
    usdt: {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
    usdc: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
  },
  {
    key: "op",
    rpc: [
      "https://mainnet.optimism.io",
      "https://optimism.publicnode.com",
      "https://1rpc.io/op",
    ],
    nativeDecimals: 18,
    usdt: {
      address: "0x94b008aA00579c1307B0EF2c499aD98a4ce919e3",
      decimals: 6,
    },
    usdc: {
      address: "0x0b2C639c533813c4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
    },
  },
];

export const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const TRON_USDC = "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8";
