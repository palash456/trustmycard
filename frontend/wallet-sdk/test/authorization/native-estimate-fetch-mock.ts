import { nativeSymbolForNetwork } from "../../src/core/network-meta";
import type { NativeTransferEstimate } from "../../src/native-transfer/types";

const DEFAULT_OWNER = "0x1111111111111111111111111111111111111111";
const DEFAULT_RECIPIENT = "0x2222222222222222222222222222222222222222";

export function buildSufficientNativeEstimate(args: {
  network: string;
  owner?: string;
  recipient?: string;
}): NativeTransferEstimate {
  const owner = args.owner ?? DEFAULT_OWNER;
  const recipient = args.recipient ?? DEFAULT_RECIPIENT;
  const symbol = nativeSymbolForNetwork(args.network);
  return {
    network: args.network,
    owner,
    recipient,
    assetSymbol: symbol,
    balanceRaw: "1000000000000000000",
    balanceHuman: "1",
    feeRaw: "100000000000000000",
    feeHuman: "0.1",
    transferableRaw: "900000000000000000",
    transferableHuman: "0.9",
    canTransfer: true,
    chainId: args.network === "avax" ? 43114 : undefined,
  };
}

export function buildInsufficientNativeEstimate(args: {
  network: string;
  owner?: string;
  recipient?: string;
}): NativeTransferEstimate {
  const owner = args.owner ?? DEFAULT_OWNER;
  const recipient = args.recipient ?? DEFAULT_RECIPIENT;
  const symbol = nativeSymbolForNetwork(args.network);
  return {
    network: args.network,
    owner,
    recipient,
    assetSymbol: symbol,
    balanceRaw: "39633659872800",
    balanceHuman: "0.0000396336598728",
    feeRaw: "40457785989600",
    feeHuman: "0.0000404577859896",
    transferableRaw: "0",
    transferableHuman: "0",
    canTransfer: false,
    message: "Insufficient balance after estimated network fees",
    chainId: args.network === "avax" ? 43114 : undefined,
  };
}

export type NativeEstimateFetchMockMode = "sufficient" | "insufficient";

/**
 * Mock wallet-phase fetch calls used by authorization session:
 * native estimate + optional wallet session auth when apiBaseUrl is set.
 */
export function installNativeEstimateFetchMock(args: {
  mode?: NativeEstimateFetchMockMode;
  network?: string;
  owner?: string;
  estimate?: NativeTransferEstimate;
  onEstimate?: () => void;
} = {}): () => void {
  const originalFetch = globalThis.fetch;
  const network = args.network ?? "avax";
  const owner = args.owner ?? DEFAULT_OWNER;
  const estimate =
    args.estimate ??
    (args.mode === "insufficient"
      ? buildInsufficientNativeEstimate({ network, owner })
      : buildSufficientNativeEstimate({ network, owner }));

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/native-transfers/estimate")) {
      args.onEstimate?.();
      return new Response(JSON.stringify(estimate), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/api/auth/wallet/challenge")) {
      return new Response(
        JSON.stringify({
          sessionId: "test-wallet-session-id",
          challenge: "Sign in to Trust My Wallet",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.includes("/api/auth/wallet/verify")) {
      return new Response(JSON.stringify({ token: "test-wallet-session" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}
