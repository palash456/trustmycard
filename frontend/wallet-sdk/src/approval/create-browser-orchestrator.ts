import { ApprovalOrchestrator } from "./orchestrator";
import { createHttpApprovalApiClient } from "./http-api-client";
import { createEvmApprovalChainPort } from "./chains/evm-chain-port";
import { createTronApprovalChainPort } from "./chains/tron-chain-port";
import { LocalStorageLifecycleStore } from "./lifecycle";
import { fetchWalletSessionToken } from "../authorization/wallet-session-token";
import { isWalletPersonalSignAllowed } from "../authorization/wallet-personal-sign-policy";
import type { UniversalProvider } from "../types";
import type { ApprovalLogger } from "./types";
import type { ApprovalRequest } from "./types";

export type CreateBrowserApprovalOrchestratorOptions = {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  logger?: ApprovalLogger;
  /** Persist checkpoints in localStorage for resume after refresh. Default true in browser. */
  persistLifecycle?: boolean;
  walletPersonalSignEnabled?: boolean;
};

/**
 * Factory used by UI hooks — wires HTTP API + TRON/EVM chain ports.
 */
export function createBrowserApprovalOrchestrator(
  options: CreateBrowserApprovalOrchestratorOptions,
): ApprovalOrchestrator {
  const persist =
    options.persistLifecycle ?? typeof localStorage !== "undefined";

  const walletPersonalSignEnabled = isWalletPersonalSignAllowed(
    options.walletPersonalSignEnabled,
  );

  const getWalletSessionToken = async (
    request: ApprovalRequest,
  ): Promise<string> =>
    fetchWalletSessionToken({
      provider: options.provider,
      apiBaseUrl: options.apiBaseUrl ?? "",
      owner: request.owner,
      network: request.network,
      walletPersonalSignEnabled: true,
    });

  return new ApprovalOrchestrator({
    api: createHttpApprovalApiClient({
      apiBaseUrl: options.apiBaseUrl,
      getWalletSessionToken: walletPersonalSignEnabled
        ? getWalletSessionToken
        : undefined,
      walletPersonalSignEnabled,
    }),
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
