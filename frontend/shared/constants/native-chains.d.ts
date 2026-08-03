/**
 * Single source of truth for supported native-transfer networks.
 * Imported by wallet-sdk and backend (via tsconfig path alias).
 */
export type EvmChainKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base";
export type SupportedNetworkKey = EvmChainKey | "tron";
export type NetworkChainMeta = {
    key: SupportedNetworkKey;
    chainId?: number;
    nativeSymbol: string;
    nativeDecimals: number;
    /** Primary RPC used for reads / confirmation polling. */
    rpcUrl: string;
    /** Fallback RPC endpoints (backend only). */
    rpcFallbacks?: readonly string[];
    /** BSC uses legacy gasPrice instead of EIP-1559. */
    legacyGas?: boolean;
};
export declare const NATIVE_CHAIN_REGISTRY: Record<SupportedNetworkKey, NetworkChainMeta>;
export declare const EVM_CHAIN_KEYS: EvmChainKey[];
export declare const EVM_CHAIN_ID: Record<EvmChainKey, number>;
export declare const EVM_RPC: Record<EvmChainKey, string>;
export declare function isEvmChainKey(key: string): key is EvmChainKey;
export declare function isSupportedNetwork(key: string): key is SupportedNetworkKey;
export declare function isEvmLegacyGasNetwork(network: string): boolean;
export declare function nativeSymbolFor(key: SupportedNetworkKey): string;
export declare function nativeDecimalsFor(key: SupportedNetworkKey): number;
export declare function evmRpcUrls(network: EvmChainKey): string[];
/** Params for wallet_addEthereumChain when switch fails. */
export declare function evmWalletAddChainParams(network: EvmChainKey): {
    chainId: string;
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
};
export declare function evmNetworkForChainId(chainId: number): EvmChainKey | null;
export declare const TRON_GRID_URL: string;
/** TRON account activation costs ~1 TRX when recipient account is new. */
export declare const TRON_ACCOUNT_ACTIVATION_SUN: bigint;
//# sourceMappingURL=native-chains.d.ts.map