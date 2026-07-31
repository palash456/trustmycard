import type { UniversalProvider } from "../types";
import { fetchWalletSessionToken } from "../authorization/wallet-session-token";
import { createEvmNativeTransferChainPort } from "./chains/evm-native-port";
import { createTronNativeTransferChainPort } from "./chains/tron-native-port";
import { createHttpNativeTransferApiClient } from "./http-api-client";
import { NativeTransferOrchestrator } from "./orchestrator";
import type { NativeTransferLogger, NativeTransferRequest } from "./types";

export type CreateBrowserNativeTransferOrchestratorOptions = {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  logger?: NativeTransferLogger;
};

export function createBrowserNativeTransferOrchestrator(
  options: CreateBrowserNativeTransferOrchestratorOptions
): NativeTransferOrchestrator {
  const apiBaseUrl = options.apiBaseUrl ?? "";

  const getWalletSessionToken = async (request: NativeTransferRequest) =>
    fetchWalletSessionToken({
      provider: options.provider,
      apiBaseUrl,
      owner: request.owner,
      network: request.network,
    });

  return new NativeTransferOrchestrator({
    api: createHttpNativeTransferApiClient({
      apiBaseUrl,
      getWalletSessionToken,
    }),
    chains: [
      createTronNativeTransferChainPort({
        provider: options.provider,
        apiBaseUrl,
      }),
      createEvmNativeTransferChainPort({ provider: options.provider }),
    ],
    logger: options.logger,
    evmProvider: options.provider,
  });
}
