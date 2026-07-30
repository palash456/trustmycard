import type { UniversalProvider, WcSession } from "../types";

export class WrongNetworkError extends Error {
  readonly expectedChainId: number;
  readonly actualChainId: number;

  constructor(expectedChainId: number, actualChainId: number) {
    super(
      `Wallet is on chain ${actualChainId}, expected ${expectedChainId}. Please switch networks.`
    );
    this.name = "WrongNetworkError";
    this.expectedChainId = expectedChainId;
    this.actualChainId = actualChainId;
  }
}

export class NoEvmSessionError extends Error {
  constructor() {
    super(
      "No EVM wallet in this session. Reconnect with an EVM-capable wallet or select Tron."
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
      trimmed.startsWith("0x") ? 16 : 10
    );
  }
  return null;
}

/**
 * Ensures the wallet provider is connected to the expected EVM chain.
 * All JSON-RPC calls are scoped to eip155:{chainId} so Tron-only sessions
 * do not route eth_* methods to TronGrid.
 */
export async function ensureEvmChain(
  provider: UniversalProvider,
  expectedChainId: number
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
      chain
    );
  } catch (err) {
    void err;
    throw new WrongNetworkError(expectedChainId, current ?? -1);
  }

  const after = parseChainId(
    await provider.request({ method: "eth_chainId" }, chain)
  );
  if (after !== expectedChainId) {
    throw new WrongNetworkError(expectedChainId, after ?? -1);
  }
}
