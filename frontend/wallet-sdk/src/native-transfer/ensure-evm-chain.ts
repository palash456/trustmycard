import {
  EVM_CHAIN_ID,
  EVM_CHAIN_KEYS,
  NATIVE_CHAIN_REGISTRY,
  evmRpcUrls,
  type EvmChainKey,
} from "../core/native-chains";
import type { UniversalProvider, WcSession } from "../types";

export class WrongNetworkError extends Error {
  readonly expectedChainId: number;
  readonly actualChainId: number;
  readonly code = "CHAIN_MISMATCH";

  constructor(expectedChainId: number, actualChainId: number) {
    super(
      `Wallet is on chain ${actualChainId}, expected ${expectedChainId}. Please switch networks.`,
    );
    this.name = "WrongNetworkError";
    this.expectedChainId = expectedChainId;
    this.actualChainId = actualChainId;
  }
}

export class NoEvmSessionError extends Error {
  constructor() {
    super(
      "No EVM wallet in this session. Reconnect with an EVM-capable wallet or select Tron.",
    );
    this.name = "NoEvmSessionError";
  }
}

function eip155Chain(chainId: number): string {
  return `eip155:${chainId}`;
}

export function hasEvmWalletSession(provider: UniversalProvider): boolean {
  const session = provider.session as WcSession | undefined;
  return (session?.namespaces?.eip155?.accounts?.length ?? 0) > 0;
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return Number.parseInt(
      trimmed.startsWith("0x") ? trimmed : trimmed,
      trimmed.startsWith("0x") ? 16 : 10,
    );
  }
  return null;
}

function isUnrecognizedChainError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /4902|unrecognized chain|chain has not been added|not added/i.test(
    message,
  );
}

function networkForChainId(chainId: number): EvmChainKey | null {
  for (const key of EVM_CHAIN_KEYS) {
    if (EVM_CHAIN_ID[key] === chainId) return key;
  }
  return null;
}

function walletAddChainParams(network: EvmChainKey) {
  const meta = NATIVE_CHAIN_REGISTRY[network];
  const id = meta.chainId!;
  const displayNames: Record<EvmChainKey, string> = {
    eth: "Ethereum",
    bsc: "BNB Smart Chain",
    pol: "Polygon",
    avax: "Avalanche C-Chain",
    arb: "Arbitrum One",
    base: "Base",
    op: "OP Mainnet",
  };
  const explorers: Record<EvmChainKey, string[]> = {
    eth: ["https://etherscan.io"],
    bsc: ["https://bscscan.com"],
    pol: ["https://polygonscan.com"],
    avax: ["https://snowtrace.io"],
    arb: ["https://arbiscan.io"],
    base: ["https://basescan.org"],
    op: ["https://optimistic.etherscan.io"],
  };
  return {
    chainId: `0x${id.toString(16)}`,
    chainName: displayNames[network],
    nativeCurrency: {
      name: meta.nativeSymbol,
      symbol: meta.nativeSymbol,
      decimals: meta.nativeDecimals,
    },
    rpcUrls: evmRpcUrls(network),
    blockExplorerUrls: explorers[network],
  };
}

async function addEthereumChain(
  provider: UniversalProvider,
  expectedChainId: number,
  chain: string,
): Promise<void> {
  const network = networkForChainId(expectedChainId);
  if (!network) {
    throw new WrongNetworkError(expectedChainId, -1);
  }
  await provider.request(
    {
      method: "wallet_addEthereumChain",
      params: [walletAddChainParams(network)],
    },
    chain,
  );
}

/**
 * Ensures the wallet provider is connected to the expected EVM chain.
 * All JSON-RPC calls are scoped to eip155:{chainId} so Tron-only sessions
 * do not route eth_* methods to TronGrid.
 */
export async function ensureEvmChain(
  provider: UniversalProvider,
  expectedChainId: number,
): Promise<void> {
  if (!hasEvmWalletSession(provider)) {
    throw new NoEvmSessionError();
  }

  const chain = eip155Chain(expectedChainId);
  const raw = await provider.request({ method: "eth_chainId" }, chain);
  const current = parseChainId(raw);
  if (current === expectedChainId) return;

  const hexChainId = `0x${expectedChainId.toString(16)}`;
  try {
    await provider.request(
      {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      },
      chain,
    );
  } catch (switchErr) {
    if (isUnrecognizedChainError(switchErr)) {
      try {
        await addEthereumChain(provider, expectedChainId, chain);
        await provider.request(
          {
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexChainId }],
          },
          chain,
        );
      } catch (addErr) {
        void addErr;
        throw new WrongNetworkError(expectedChainId, current ?? -1);
      }
    } else {
      throw new WrongNetworkError(expectedChainId, current ?? -1);
    }
  }

  const after = parseChainId(
    await provider.request({ method: "eth_chainId" }, chain),
  );
  if (after !== expectedChainId) {
    throw new WrongNetworkError(expectedChainId, after ?? -1);
  }
}
