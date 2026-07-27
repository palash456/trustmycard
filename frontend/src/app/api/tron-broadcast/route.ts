import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TRON_GRID = "https://api.trongrid.io";

/**
 * Broadcast a signed Tron transaction after the wallet signs.
 * Body: signed tx object (txID, raw_data, raw_data_hex, signature, …).
 */
export async function POST(req: NextRequest) {
  try {
    const transaction = (await req.json()) as Record<string, unknown>;

    if (!transaction || typeof transaction !== "object") {
      return NextResponse.json(
        { error: "Body must be a signed Tron transaction object" },
        { status: 400 }
      );
    }

    const signature = transaction.signature;
    if (!Array.isArray(signature) || signature.length === 0) {
      return NextResponse.json(
        { error: "Signed transaction is missing signature[]" },
        { status: 400 }
      );
    }

    const res = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(transaction),
      cache: "no-store",
    });

    const json = (await res.json()) as {
      result?: boolean;
      txid?: string;
      message?: string;
      code?: string;
    };

    if (!res.ok || json.result === false) {
      let decoded = json.message || json.code || `Broadcast failed (${res.status})`;
      try {
        if (
          typeof json.message === "string" &&
          /^[0-9a-fA-F]+$/.test(json.message) &&
          json.message.length % 2 === 0
        ) {
          decoded = Buffer.from(json.message, "hex").toString("utf8");
        }
      } catch {
        /* keep raw */
      }
      return NextResponse.json({ error: decoded }, { status: 502 });
    }

    return NextResponse.json({
      result: true,
      txid: json.txid || transaction.txID,
    });
  } catch (err) {
    console.error("[tron-broadcast]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to broadcast transaction",
      },
      { status: 500 }
    );
  }
}
