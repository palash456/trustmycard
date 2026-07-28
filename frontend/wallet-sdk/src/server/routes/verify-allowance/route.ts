import { NextRequest, NextResponse } from "next/server";
import { isEvmChainKey, type TokenSymbol } from "../../../core/chain-tokens";
import { readAllowance } from "../../approvals/read-allowance";

export const dynamic = "force-dynamic";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function parseToken(raw: unknown): TokenSymbol {
  const s = String(raw ?? "USDT").trim().toUpperCase();
  if (s === "USDT" || s === "USDC") return s;
  throw new Error("token must be USDT or USDC");
}

/**
 * Read-only allowance(owner, spender) check.
 * Request: { network, owner, spender, token? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      owner?: string;
      spender?: string;
      token?: string;
    };
    const network = (body.network ?? "").trim().toLowerCase();
    const owner = (body.owner ?? "").trim();
    const spender = (body.spender ?? "").trim();
    let token: TokenSymbol;
    try {
      token = parseToken(body.token);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "bad token" },
        { status: 400 }
      );
    }

    if (!spender) {
      return NextResponse.json(
        { ok: false, error: "spender is required" },
        { status: 400 }
      );
    }

    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(spender)) {
        return NextResponse.json(
          { ok: false, error: "Invalid Tron owner/spender" },
          { status: 400 }
        );
      }
    } else if (!isEvmChainKey(network)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported network" },
        { status: 400 }
      );
    } else if (!EVM_ADDRESS_RE.test(owner) || !EVM_ADDRESS_RE.test(spender)) {
      return NextResponse.json(
        { ok: false, error: "Invalid EVM owner/spender" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await readAllowance({ network, owner, spender, token })
    );
  } catch (err) {
    console.error("[verify-allowance]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Allowance verification failed",
      },
      { status: 500 }
    );
  }
}
