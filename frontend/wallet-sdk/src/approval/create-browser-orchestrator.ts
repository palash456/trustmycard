import { ApprovalOrchestrator } from "./orchestrator";
import { createHttpApprovalApiClient } from "./http-api-client";
import { createEvmApprovalChainPort } from "./chains/evm-chain-port";
import { createTronApprovalChainPort } from "./chains/tron-chain-port";
import { LocalStorageLifecycleStore } from "./lifecycle";
import type { UniversalProvider } from "../types";
import type { ApprovalLogger } from "./types";
import type { ApprovalRequest } from "./types";
import { NATIVE_CHAIN_REGISTRY } from "../core/native-chains";
import { resolveApiUrl } from "../core/api-url";

export type CreateBrowserApprovalOrchestratorOptions = {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  logger?: ApprovalLogger;
  /** Persist checkpoints in localStorage for resume after refresh. Default true in browser. */
  persistLifecycle?: boolean;
};

/**
 * Factory used by UI hooks — wires HTTP API + TRON/EVM chain ports.
 */
export function createBrowserApprovalOrchestrator(
  options: CreateBrowserApprovalOrchestratorOptions
): ApprovalOrchestrator {
  const persist =
    options.persistLifecycle ??
    (typeof localStorage !== "undefined");

  const getWalletSessionToken = async (request: ApprovalRequest): Promise<string> => {
    const apiBaseUrl = options.apiBaseUrl ?? "";
    const challengeResponse = await fetch(resolveApiUrl(apiBaseUrl, "/api/auth/wallet/challenge"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: request.owner, network: request.network }),
    });
    const challenge = await challengeResponse.json() as { sessionId?: string; challenge?: string; message?: string };
    if (!challengeResponse.ok || !challenge.sessionId || !challenge.challenge) {
      throw new Error(String(challenge.message ?? "Failed to create wallet authentication challenge"));
    }
    const chain = request.network === "tron"
      ? "tron:0x2b6653dc"
      : `eip155:${NATIVE_CHAIN_REGISTRY[request.network as keyof typeof NATIVE_CHAIN_REGISTRY]?.chainId}`;
    const method = request.network === "tron" ? "tron_signMessageV2" : "personal_sign";
    const params = request.network === "tron"
      ? [challenge.challenge]
      : [challenge.challenge, request.owner];
    const signature = await options.provider.request({ method, params }, chain);
    const verifyResponse = await fetch(resolveApiUrl(apiBaseUrl, "/api/auth/wallet/verify"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: challenge.sessionId, signature }),
    });
    const verified = await verifyResponse.json() as { token?: string; message?: string };
    if (!verifyResponse.ok || !verified.token) {
      throw new Error(String(verified.message ?? "Wallet authentication failed"));
    }
    return verified.token;
  };

  return new ApprovalOrchestrator({
    api: createHttpApprovalApiClient({ apiBaseUrl: options.apiBaseUrl, getWalletSessionToken }),
    chains: [
      createTronApprovalChainPort({
        provider: options.provider,
        apiBaseUrl: options.apiBaseUrl,
      }),
      createEvmApprovalChainPort({ provider: options.provider }),
    ],
    logger: options.logger,
    lifecycleStore: persist ? new LocalStorageLifecycleStore() : undefined,
  });
}

