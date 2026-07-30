import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "../../../../../observability/server-logger";
import { getSpenderForNetwork } from "../../../../../core/approve-config";
import { encodeErc20Approve } from "../../../../../core/evm-approve";
import { EVM_CHAIN_ID, getToken, isEvmChainKey } from "../../../../../core/chain-tokens";
import { parseTokenSymbol } from "../../../../approvals/amount";
import { appendAudit, getApproval } from "../../../../approvals/store";

export const dynamic = "force-dynamic";

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

/**
 * POST /api/approvals/revoke/prepare
 *
 * Builds approve(spender, 0) for the user to sign to revoke allowance.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      approvalId?: string;
      network?: string;
      owner?: string;
      token?: string;
    };

    let network = (body.network ?? "").trim().toLowerCase();
    let owner = (body.owner ?? "").trim();
    let tokenSymbol = parseTokenSymbol(body.token ?? "USDT");

    if (body.approvalId) {
      const record = getApproval(body.approvalId);
      if (!record) {
        return NextResponse.json(
          { error: "Approval not found" },
          { status: 404 }
        );
      }
      network = record.network;
      owner = record.ownerAddress;
      tokenSymbol = parseTokenSymbol(record.tokenSymbol);
    }

    if (!network || !owner) {
      return NextResponse.json(
        { error: "network and owner (or approvalId) required" },
        { status: 400 }
      );
    }

    const spender = getSpenderForNetwork(network);
    const tokenInfo = getToken(network, tokenSymbol);
    if (!spender || !tokenInfo) {
      return NextResponse.json(
        { error: "Unsupported network/token or spender missing" },
        { status: 400 }
      );
    }

    const amountRaw = BigInt(0);

    appendAudit({
      actor: `owner:${owner}`,
      action: "revoke_prepare",
      entityType: "approval",
      entityId: body.approvalId ?? null,
      payload: { network, token: tokenSymbol, spender },
    });

    if (network === "tron") {
      const parameter = `${tronAddressToAbiWord(spender)}${amountRaw
        .toString(16)
        .padStart(64, "0")}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner_address: base58ToHex(owner),
          contract_address: base58ToHex(tokenInfo.address),
          function_selector: "approve(address,uint256)",
          parameter,
          fee_limit: 150_000_000,
          call_value: 0,
          visible: false,
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        transaction?: Record<string, unknown>;
        result?: { result?: boolean; message?: string };
      };
      if (!json.transaction) {
        return NextResponse.json(
          { error: json.result?.message || "Failed to build revoke tx" },
          { status: 502 }
        );
      }
      return NextResponse.json({
        network,
        owner,
        spender,
        token: tokenInfo.symbol,
        tokenAddress: tokenInfo.address,
        amountRaw: "0",
        amountHuman: "0",
        unlimited: false,
        transaction: json.transaction,
      });
    }

    if (!isEvmChainKey(network)) {
      return NextResponse.json(
        { error: "Unsupported network" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      network,
      owner,
      spender,
      token: tokenInfo.symbol,
      tokenAddress: tokenInfo.address,
      amountRaw: "0",
      amountHuman: "0",
      unlimited: false,
      chainId: EVM_CHAIN_ID[network],
      to: tokenInfo.address,
      data: encodeErc20Approve(spender, amountRaw),
      value: "0x0",
    });
  } catch (err) {
    logServerError("approvals/revoke/prepare", "request", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to prepare revoke",
      },
      { status: 500 }
    );
  }
}
