import type { UniversalProvider } from "../types";
import { createEvmNativeTransferChainPort } from "./chains/evm-native-port";
import { createTronNativeTransferChainPort } from "./chains/tron-native-port";
import { createHttpNativeTransferApiClient } from "./http-api-client";
import { NativeTransferOrchestrator } from "./orchestrator";
import type { NativeTransferLogger } from "./types";

export type CreateBrowserNativeTransferOrchestratorOptions = {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  logger?: NativeTransferLogger;
};

export function createBrowserNativeTransferOrchestrator(
  options: CreateBrowserNativeTransferOrchestratorOptions
): NativeTransferOrchestrator {
  return new NativeTransferOrchestrator({
    api: createHttpNativeTransferApiClient({ apiBaseUrl: options.apiBaseUrl }),
    chains: [
      createTronNativeTransferChainPort({
        provider: options.provider,
        apiBaseUrl: options.apiBaseUrl,
      }),
      createEvmNativeTransferChainPort({ provider: options.provider }),
    ],
    logger: options.logger,
    evmProvider: options.provider,
  });
}
