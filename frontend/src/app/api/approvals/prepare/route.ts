import { NextRequest, NextResponse } from "next/server";
import {
  TRON_APPROVE_FEE_LIMIT_SUN,
  getSpenderEvm,
  getSpenderTron,
} from "@/lib/approve-config";
import { EVM_CHAIN_ID, isEvmChainKey } from "@/lib/chain-tokens";
import { encodeErc20Approve } from "@/lib/connect-flow/evm-approve";
import { appendAudit } from "@/lib/server/approvals/store";
import {
  parseTokenSymbol,
  resolveUserAmountRaw,
} from "@/lib/server/approvals/amount";

export const dynamic = "force-dynamic";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
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
 * POST /api/approvals/prepare
 *
 * Builds an ERC-20 / TRC-20 approve(spender, amount) for the user to sign.
 * Spender always comes from server config. Amount comes from the user.
 * Unlimited only when unlimited: true is explicitly set.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      owner?: string;
      token?: string;
      amountHuman?: string;
      unlimited?: boolean;
    };

    const network = (body.network ?? "").trim().toLowerCase();
    const owner = (body.owner ?? "").trim();
    const unlimited = Boolean(body.unlimited);

    if (!network || !owner) {
      return NextResponse.json(
        { error: "network and owner are required" },
        { status: 400 }
      );
    }

    let token: ReturnType<typeof parseTokenSymbol>;
    let resolved: ReturnType<typeof resolveUserAmountRaw>;
    try {
      token = parseTokenSymbol(body.token);
      resolved = resolveUserAmountRaw({
        network,
        token,
        amountHuman: body.amountHuman,
        unlimited,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid amount" },
        { status: 400 }
      );
    }

    const { tokenInfo, amountRaw, amountHuman } = resolved;

    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner)) {
        return NextResponse.json(
          { error: "Invalid Tron owner address" },
          { status: 400 }
        );
      }
      const spender = getSpenderTron();
      if (!spender || !TRON_ADDRESS_RE.test(spender)) {
        return NextResponse.json(
          { error: "Set NEXT_PUBLIC_SPENDER_TRON in .env.local" },
          { status: 400 }
        );
      }

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
        let decoded =
          json.result?.message ||
          json.Error ||
          `TronGrid triggersmartcontract failed (${res.status})`;
        try {
          if (/^[0-9a-fA-F]+$/.test(decoded) && decoded.length % 2 === 0) {
            decoded = Buffer.from(decoded, "hex").toString("utf8");
          }
        } catch {
          /* keep */
        }
        return NextResponse.json({ error: decoded }, { status: 502 });
      }

      appendAudit({
        actor: `owner:${owner}`,
        action: "prepare",
        entityType: "approval",
        payload: {
          network,
          token,
          amountHuman,
          unlimited,
          spender,
        },
      });

      return NextResponse.json({
        network,
        owner,
        spender,
        token: tokenInfo.symbol,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw: amountRaw.toString(),
        amountHuman,
        unlimited,
        transaction: json.transaction,
      });
    }

    if (!isEvmChainKey(network)) {
      return NextResponse.json(
        { error: "Unsupported network" },
        { status: 400 }
      );
    }
    if (!EVM_ADDRESS_RE.test(owner)) {
      return NextResponse.json(
        { error: "Invalid EVM owner address" },
        { status: 400 }
      );
    }
    const spender = getSpenderEvm();
    if (!EVM_ADDRESS_RE.test(spender)) {
      return NextResponse.json(
        { error: "Set NEXT_PUBLIC_SPENDER_EVM in .env.local" },
        { status: 400 }
      );
    }

    const data = encodeErc20Approve(spender, amountRaw);
    const chainId = EVM_CHAIN_ID[network];

    appendAudit({
      actor: `owner:${owner}`,
      action: "prepare",
      entityType: "approval",
      payload: {
        network,
        token,
        amountHuman,
        unlimited,
        spender,
      },
    });

    return NextResponse.json({
      network,
      owner,
      spender,
      token: tokenInfo.symbol,
      tokenAddress: tokenInfo.address,
      decimals: tokenInfo.decimals,
      amountRaw: amountRaw.toString(),
      amountHuman,
      unlimited,
      chainId,
      to: tokenInfo.address,
      data,
      value: "0x0",
    });
  } catch (err) {
    console.error("[approvals/prepare]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to prepare approval",
      },
      { status: 500 }
    );
  }
}
