import { nativeSymbolForNetwork } from "../core/network-meta";
import { createHttpNativeTransferApiClient } from "../native-transfer/http-api-client";
import type { NativeTransferEstimate } from "../native-transfer/types";

export function isNativeTransferEstimateSufficient(
  estimate: NativeTransferEstimate,
): boolean {
  if (!estimate.canTransfer) return false;
  try {
    return BigInt(estimate.transferableRaw) > BigInt(0);
  } catch {
    return false;
  }
}

/** User-facing message when native balance cannot cover transfer fees (all chains). */
export function formatInsufficientNativeFeeMessage(network: string): string {
  const symbol = nativeSymbolForNetwork(network);
  return `Add more ${symbol} for network fees`;
}

export type NativePreflightResult =
  | { ok: true; estimate: NativeTransferEstimate }
  | { ok: false; message: string; estimate: NativeTransferEstimate };

export async function preflightNativeTransferEstimate(args: {
  apiBaseUrl?: string;
  network: string;
  owner: string;
  traceId?: string;
  signal?: AbortSignal;
}): Promise<NativePreflightResult> {
  const api = createHttpNativeTransferApiClient({
    apiBaseUrl: args.apiBaseUrl,
  });
  const estimate = await api.estimate({
    request: {
      network: args.network,
      owner: args.owner,
      traceId: args.traceId,
    },
    signal: args.signal,
  });

  if (isNativeTransferEstimateSufficient(estimate)) {
    return { ok: true, estimate };
  }

  return {
    ok: false,
    message: formatInsufficientNativeFeeMessage(args.network),
    estimate,
  };
}
