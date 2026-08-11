import { EVM_CHAIN_ID, isEvmChainKey } from "../core/native-chains";
import { pollCallsStatus } from "../core/evm-wallet-batch";
import type { UniversalProvider } from "../types";

export type BatchNativeReconcileResult =
  | { status: "succeeded"; txHash: string }
  | { status: "failed_revert" }
  | { status: "unknown" };

/**
 * Re-poll wallet_getCallsStatus to resolve ambiguous EIP-5792 batch native execution.
 * Never broadcasts or prompts the wallet — read-only reconciliation.
 */
export async function reconcileEvmBatchNative(args: {
  provider: UniversalProvider;
  batchId: string;
  chainId: number;
  tokenJobCount: number;
  pollIntervalMs?: number;
  maxAttempts?: number;
}): Promise<BatchNativeReconcileResult> {
  try {
    const status = await pollCallsStatus(
      args.provider,
      args.batchId,
      args.chainId,
      {
        pollIntervalMs: args.pollIntervalMs ?? 2_000,
        maxAttempts: args.maxAttempts ?? 30,
      },
    );

    const nativeReceipt = status.receipts[args.tokenJobCount];
    if (nativeReceipt && nativeReceipt.status !== "reverted") {
      return {
        status: "succeeded",
        txHash: nativeReceipt.transactionHash,
      };
    }

    if (status.status === "CONFIRMED" || status.status === "FAILED") {
      return { status: "failed_revert" };
    }

    return { status: "unknown" };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "BATCH_CONFIRMATION_TIMEOUT") {
      return { status: "unknown" };
    }
    throw err;
  }
}

export function resolveChainIdForNetwork(network: string): number | null {
  if (!isEvmChainKey(network)) return null;
  return EVM_CHAIN_ID[network] ?? null;
}
