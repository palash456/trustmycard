import type { UniversalProvider } from "../types";

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

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return Number.parseInt(trimmed.startsWith("0x") ? trimmed : trimmed, trimmed.startsWith("0x") ? 16 : 10);
  }
  return null;
}

/**
 * Ensures the wallet provider is connected to the expected EVM chain.
 * Prompts wallet_switchEthereumChain when mismatched.
 */
export async function ensureEvmChain(
  provider: UniversalProvider,
  expectedChainId: number
): Promise<void> {
  const raw = await provider.request({ method: "eth_chainId" });
  const current = parseChainId(raw);
  if (current === expectedChainId) return;

  const hexChainId = `0x${expectedChainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (err) {
    void err;
    throw new WrongNetworkError(expectedChainId, current ?? -1);
  }

  const after = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (after !== expectedChainId) {
    throw new WrongNetworkError(expectedChainId, after ?? -1);
  }
}
