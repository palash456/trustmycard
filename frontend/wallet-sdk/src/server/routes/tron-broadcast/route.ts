import { getErrorMessage } from "../../../core/errors";
import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "../../../observability/server-logger";
import { flowLog } from "../../approvals/flow-logger";

export const dynamic = "force-dynamic";

const TRON_GRID = "https://api.trongrid.io";

function decodeTronMessage(message: unknown): string | null {
  if (typeof message !== "string" || !message) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
      return Buffer.from(message, "hex").toString("utf8");
    }
  } catch {
    /* keep raw */
  }
  return message;
}

function humanizeBroadcastFailure(args: {
  code?: string;
  message?: string | null;
  httpStatus: number;
}): string {
  const code = (args.code ?? "").toUpperCase();
  const msg = (args.message ?? "").trim();

  if (
    code.includes("BANDWITH") ||
    code.includes("BANDWIDTH") ||
    /resource insufficient|bandwidth|energy/i.test(msg)
  ) {
    return (
      "Tron broadcast rejected: account has insufficient Bandwidth/Energy/TRX. " +
      "Fund the wallet with a small amount of TRX (or stake for energy), then try again. " +
      (msg ? `Node: ${msg}` : code ? `Code: ${code}` : "")
    ).trim();
  }

  if (code === "SIGERROR" || /signature/i.test(msg)) {
    return `Tron broadcast rejected: invalid signature. ${msg || code}`.trim();
  }

  if (msg) return `Tron broadcast failed: ${msg}${code ? ` (${code})` : ""}`;
  if (code) return `Tron broadcast failed: ${code}`;
  return `Tron broadcast failed (HTTP ${args.httpStatus})`;
}

/**
 * Broadcast a signed Tron transaction after the wallet signs.
 *
 * Success requires TronGrid `result === true`. Responses that only include
 * `code` / `message` / a pre-computed `txid` (e.g. BANDWITH_ERROR) are failures.
 * We never return a phantom txid from the unsigned transaction on failure.
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

    const localTxId =
      typeof transaction.txID === "string" ? transaction.txID : null;

    const res = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(transaction),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => ({}))) as {
      result?: boolean;
      txid?: string;
      message?: string;
      code?: string;
      [key: string]: unknown;
    };

    const decodedMessage = decodeTronMessage(json.message);
    const accepted = res.ok && json.result === true;
    const nodeTxid =
      typeof json.txid === "string" && json.txid.length > 0
        ? json.txid
        : null;

    flowLog(
      accepted
        ? "TRON BROADCAST — ACCEPTED BY NODE"
        : "TRON BROADCAST — REJECTED BY NODE",
      {
        httpStatus: res.status,
        accepted,
        localTxIdBeforeBroadcast: localTxId,
        nodeResult: json.result ?? null,
        nodeCode: json.code ?? null,
        nodeMessageRaw: json.message ?? null,
        nodeMessageDecoded: decodedMessage,
        nodeTxid,
        fullNodeResponse: json,
      }
    );

    if (!accepted) {
      const error = humanizeBroadcastFailure({
        code: typeof json.code === "string" ? json.code : undefined,
        message: decodedMessage,
        httpStatus: res.status,
      });

      return NextResponse.json(
        {
          result: false,
          error,
          code: json.code ?? null,
          message: decodedMessage,
          // Include node txid for debugging only — client must not treat as success
          nodeTxid,
          localTxId,
          trongrid: json,
        },
        { status: 502 }
      );
    }

    // Only return a txid the node acknowledged with result:true
    const txid = nodeTxid || localTxId;
    if (!txid) {
      return NextResponse.json(
        {
          result: false,
          error:
            "TronGrid returned result:true but no txid — refusing to invent a hash",
          trongrid: json,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      result: true,
      txid,
      trongrid: json,
    });
  } catch (err) {
    logServerError("tron-broadcast", "request", err);
    flowLog("TRON BROADCAST — EXCEPTION", {
      error: getErrorMessage(err),
    });
    return NextResponse.json(
      {
        result: false,
        error: getErrorMessage(err, "Failed to broadcast transaction"),
      },
      { status: 500 }
    );
  }
}
