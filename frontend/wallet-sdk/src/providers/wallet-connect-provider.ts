import { resolveWalletConnectMetadata } from "../core/constants";
import type { UniversalProvider } from "../types";

type UniversalProviderCtor =
  typeof import("@walletconnect/universal-provider").default;

let sharedProvider: UniversalProvider | null = null;
let initPromise: Promise<UniversalProvider> | null = null;

/**
 * WalletConnect UniversalProvider.init() warns when called more than once.
 * React Strict Mode and HMR remounts otherwise create duplicate instances.
 */
export async function getSharedUniversalProvider(
  UniversalProviderCtor: UniversalProviderCtor,
  projectId: string,
): Promise<UniversalProvider> {
  if (sharedProvider) return sharedProvider;
  if (initPromise) return initPromise;

  initPromise = UniversalProviderCtor.init({
    projectId,
    metadata: resolveWalletConnectMetadata(),
  }).then((provider) => {
    sharedProvider = provider;
    return provider;
  });

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}
