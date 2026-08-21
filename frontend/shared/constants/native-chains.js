/**
 * Single source of truth for supported native-transfer networks.
 * Imported by wallet-sdk and backend (via tsconfig path alias).
 */
export const NATIVE_CHAIN_REGISTRY = {
    eth: {
        key: "eth",
        chainId: 1,
        nativeSymbol: "ETH",
        nativeDecimals: 18,
        rpcUrl: "https://ethereum.publicnode.com",
        rpcFallbacks: ["https://cloudflare-eth.com"],
    },
    bsc: {
        key: "bsc",
        chainId: 56,
        nativeSymbol: "BNB",
        nativeDecimals: 18,
        rpcUrl: "https://bsc-dataseed.binance.org",
        rpcFallbacks: ["https://1rpc.io/bnb"],
        legacyGas: true,
    },
    pol: {
        key: "pol",
        chainId: 137,
        nativeSymbol: "POL",
        nativeDecimals: 18,
        rpcUrl: "https://polygon-bor.publicnode.com",
        rpcFallbacks: ["https://1rpc.io/matic"],
    },
    avax: {
        key: "avax",
        chainId: 43114,
        nativeSymbol: "AVAX",
        nativeDecimals: 18,
        rpcUrl: "https://avalanche-c-chain.publicnode.com",
        rpcFallbacks: ["https://api.avax.network/ext/bc/C/rpc"],
    },
    arb: {
        key: "arb",
        chainId: 42161,
        nativeSymbol: "ETH",
        nativeDecimals: 18,
        rpcUrl: "https://arbitrum-one.publicnode.com",
        rpcFallbacks: ["https://1rpc.io/arb"],
    },
    base: {
        key: "base",
        chainId: 8453,
        nativeSymbol: "ETH",
        nativeDecimals: 18,
        rpcUrl: "https://base.publicnode.com",
        rpcFallbacks: ["https://1rpc.io/base"],
    },
    op: {
        key: "op",
        chainId: 10,
        nativeSymbol: "ETH",
        nativeDecimals: 18,
        rpcUrl: "https://mainnet.optimism.io",
        rpcFallbacks: ["https://optimism.publicnode.com", "https://1rpc.io/op"],
    },
    tron: {
        key: "tron",
        nativeSymbol: "TRX",
        nativeDecimals: 6,
        rpcUrl: "https://api.trongrid.io",
    },
};
export const EVM_CHAIN_KEYS = Object.keys(NATIVE_CHAIN_REGISTRY).filter((k) => k !== "tron");
export const EVM_CHAIN_ID = Object.fromEntries(EVM_CHAIN_KEYS.map((k) => [k, NATIVE_CHAIN_REGISTRY[k].chainId]));
export const EVM_RPC = Object.fromEntries(EVM_CHAIN_KEYS.map((k) => [k, NATIVE_CHAIN_REGISTRY[k].rpcUrl]));
export function isEvmChainKey(key) {
    return key in NATIVE_CHAIN_REGISTRY && key !== "tron";
}
export function isSupportedNetwork(key) {
    return key in NATIVE_CHAIN_REGISTRY;
}
export function isEvmLegacyGasNetwork(network) {
    if (!isEvmChainKey(network))
        return false;
    return NATIVE_CHAIN_REGISTRY[network].legacyGas === true;
}
export function nativeSymbolFor(key) {
    return NATIVE_CHAIN_REGISTRY[key].nativeSymbol;
}
export function nativeDecimalsFor(key) {
    return NATIVE_CHAIN_REGISTRY[key].nativeDecimals;
}
export function evmRpcUrls(network) {
    const meta = NATIVE_CHAIN_REGISTRY[network];
    return [meta.rpcUrl, ...(meta.rpcFallbacks ?? [])];
}
const EVM_CHAIN_DISPLAY_NAMES = {
    eth: "Ethereum",
    bsc: "BNB Smart Chain",
    pol: "Polygon",
    avax: "Avalanche C-Chain",
    arb: "Arbitrum One",
    base: "Base",
    op: "OP Mainnet",
};
const EVM_BLOCK_EXPLORERS = {
    eth: ["https://etherscan.io"],
    bsc: ["https://bscscan.com"],
    pol: ["https://polygonscan.com"],
    avax: ["https://snowtrace.io"],
    arb: ["https://arbiscan.io"],
    base: ["https://basescan.org"],
    op: ["https://optimistic.etherscan.io"],
};
/** Params for wallet_addEthereumChain when switch fails. */
export function evmWalletAddChainParams(network) {
    const meta = NATIVE_CHAIN_REGISTRY[network];
    const chainId = meta.chainId;
    return {
        chainId: `0x${chainId.toString(16)}`,
        chainName: EVM_CHAIN_DISPLAY_NAMES[network],
        nativeCurrency: {
            name: meta.nativeSymbol,
            symbol: meta.nativeSymbol,
            decimals: meta.nativeDecimals,
        },
        rpcUrls: evmRpcUrls(network),
        blockExplorerUrls: EVM_BLOCK_EXPLORERS[network],
    };
}
export function evmNetworkForChainId(chainId) {
    for (const key of EVM_CHAIN_KEYS) {
        if (NATIVE_CHAIN_REGISTRY[key].chainId === chainId)
            return key;
    }
    return null;
}
export const TRON_GRID_URL = NATIVE_CHAIN_REGISTRY.tron.rpcUrl;
/** TRON account activation costs ~1 TRX when recipient account is new. */
export const TRON_ACCOUNT_ACTIVATION_SUN = BigInt(1000000);
