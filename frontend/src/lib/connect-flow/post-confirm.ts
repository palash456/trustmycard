import { TERMS_VERSION } from "@/lib/approve-config";
import type { TokenSymbol } from "@/lib/chain-tokens";

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
}): Promise<{
  allowance: string | null;
  confirmed: boolean;
  approvalId: string | null;
  status: string | null;
}> {
  const {
    networkKey,
    address,
    token,
    amountHuman,
    amountRaw,
    unlimited,
    txid,
  } = args;

  if (!txid) {
    return {
      allowance: null,
      confirmed: false,
      approvalId: null,
      status: null,
    };
  }

  // Soft wait for inclusion
  await sleep(networkKey === "tron" ? 1200 : 600);

  try {
    const confirmRes = await fetch("/api/approvals/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        network: networkKey,
        owner: address,
        token,
        amountHuman,
        amountRaw,
        txHash: txid,
        termsVersion: TERMS_VERSION,
        unlimited,
      }),
      cache: "no-store",
    });
    const confirmJson = (await confirmRes.json()) as {
      ok?: boolean;
      approvalId?: string;
      status?: string;
      allowance?: string;
      hasAllowance?: boolean;
      error?: string;
    };

    if (!confirmRes.ok || !confirmJson.ok) {
      throw new Error(confirmJson.error || "Failed to confirm approval");
    }

    return {
      allowance: confirmJson.allowance ?? null,
      confirmed: Boolean(confirmJson.hasAllowance),
      approvalId: confirmJson.approvalId ?? null,
      status: confirmJson.status ?? null,
    };
  } catch (err) {
    console.error("[post-confirm]", err);
    return {
      allowance: null,
      confirmed: false,
      approvalId: null,
      status: "FAILED",
    };
  }
}
