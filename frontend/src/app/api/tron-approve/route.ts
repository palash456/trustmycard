import { NextRequest, NextResponse } from "next/server";
import {
  TRON_APPROVE_FEE_LIMIT_SUN,
  getSpenderTron,
} from "@/lib/approve-config";
import {
  parseTokenSymbol,
  resolveUserAmountRaw,
} from "@/lib/server/approvals/amount";

export const dynamic = "force-dynamic";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const TRON_GRID = "https://api.trongrid.io";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToHex(base58: string): string {
  let num = BigInt(0);
  for (const ch of base58) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Invalid base58 address");
    num = num * BigInt(58) + BigInt(i);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let leading = 0;
  for (const ch of base58) {
    if (ch === "1") leading += 1;
    else break;
  }
  hex = `${"00".repeat(leading)}${hex}`;
  if (hex.length < 8) throw new Error("Address too short");
  return hex.slice(0, -8);
}

function tronAddressToAbiWord(base58: string): string {
  const hex = base58ToHex(base58);
  const body = hex.startsWith("41") ? hex.slice(2) : hex.slice(-40);
  return body.padStart(64, "0");
}

function uintToAbiWord(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

/**
 * POST /api/tron-approve
 *
 * Legacy Tron prepare endpoint. Prefer POST /api/approvals/prepare.
 * Body: { owner, amountHuman?, unlimited?, token? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      amountHuman?: string;
      unlimited?: boolean;
      token?: string;
    };
    const owner = body.owner?.trim() ?? "";
    const spender = getSpenderTron();

    if (!TRON_ADDRESS_RE.test(owner)) {
      return NextResponse.json(
        { error: "Invalid Tron owner address" },
        { status: 400 }
      );
    }
    if (!spender || !TRON_ADDRESS_RE.test(spender)) {
      return NextResponse.json(
        {
          error:
            "Set NEXT_PUBLIC_SPENDER_TRON in .env.local (placeholder spender missing)",
        },
        { status: 400 }
      );
    }

    let resolved: ReturnType<typeof resolveUserAmountRaw>;
    try {
      const token = parseTokenSymbol(body.token ?? "USDT");
      resolved = resolveUserAmountRaw({
        network: "tron",
        token,
        amountHuman: body.amountHuman,
        unlimited: Boolean(body.unlimited),
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Provide amountHuman or set unlimited: true",
        },
        { status: 400 }
      );
    }

    const { tokenInfo, amountRaw } = resolved;
    const parameter = `${tronAddressToAbiWord(spender)}${uintToAbiWord(amountRaw)}`;
    const ownerHex = base58ToHex(owner);
    const contractHex = base58ToHex(tokenInfo.address);

    const res = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner_address: ownerHex,
        contract_address: contractHex,
        function_selector: "approve(address,uint256)",
        parameter,
        fee_limit: TRON_APPROVE_FEE_LIMIT_SUN,
        call_value: 0,
        visible: false,
      }),
      cache: "no-store",
    });

    const json = (await res.json()) as {
      result?: { result?: boolean; message?: string };
      transaction?: Record<string, unknown>;
      Error?: string;
    };

    if (!res.ok || json.result?.result === false || !json.transaction) {
      const msg =
        json.result?.message ||
        json.Error ||
        `TronGrid triggersmartcontract failed (${res.status})`;
      let decoded = msg;
      try {
        if (/^[0-9a-fA-F]+$/.test(msg) && msg.length % 2 === 0) {
          decoded = Buffer.from(msg, "hex").toString("utf8");
        }
      } catch {
        /* keep raw */
      }
      return NextResponse.json({ error: decoded }, { status: 502 });
    }

    return NextResponse.json({
      result: { result: true },
      transaction: json.transaction,
      spender,
      amountRaw: amountRaw.toString(),
      token: tokenInfo.symbol,
      tokenAddress: tokenInfo.address,
    });
  } catch (err) {
    console.error("[tron-approve]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to build approve tx",
      },
      { status: 500 }
    );
  }
}
