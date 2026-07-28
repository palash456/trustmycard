import { NextRequest, NextResponse } from "next/server";
import { TERMS_VERSION, getSpenderForNetwork } from "@/lib/approve-config";
import { getToken, isEvmChainKey, type EvmChainKey } from "@/lib/chain-tokens";
import { parseTokenSymbol } from "@/lib/server/approvals/amount";
import { EVM_RPC, readAllowance } from "@/lib/server/approvals/read-allowance";
import {
  appendAudit,
  createApproval,
  getStoreSnapshot,
} from "@/lib/server/approvals/store";
import {
  logApprovalComplete,
  logStoreSnapshot,
} from "@/lib/server/approvals/flow-logger";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getEvmBlockNumber(
  network: EvmChainKey,
  txHash: string
): Promise<number | null> {
  const rpc = EVM_RPC[network];
  if (!rpc || !txHash) return null;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      result?: { blockNumber?: string; status?: string } | null;
    };
    if (!json.result?.blockNumber) return null;
    if (json.result.status === "0x0") return null;
    return parseInt(json.result.blockNumber, 16);
  } catch {
    return null;
  }
}

/**
 * POST /api/approvals/confirm
 *
 * After the user signs approve(), verify on-chain allowance and store metadata.
 * Never stores private keys.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      owner?: string;
      token?: string;
      amountHuman?: string;
      amountRaw?: string;
      txHash?: string;
      termsVersion?: string;
      unlimited?: boolean;
    };

    const network = (body.network ?? "").trim().toLowerCase();
    const owner = (body.owner ?? "").trim();
    const txHash = (body.txHash ?? "").trim();
    const amountRaw = (body.amountRaw ?? "").trim();
    const amountHuman = (body.amountHuman ?? "").trim();
    const termsVersion = (body.termsVersion ?? TERMS_VERSION).trim();
    const unlimited = Boolean(body.unlimited);

    if (!network || !owner || !txHash || !amountRaw) {
      return NextResponse.json(
        { ok: false, error: "network, owner, txHash, amountRaw required" },
        { status: 400 }
      );
    }

    let token: ReturnType<typeof parseTokenSymbol>;
    try {
      token = parseTokenSymbol(body.token);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "bad token" },
        { status: 400 }
      );
    }

    const spender = getSpenderForNetwork(network);
    if (!spender) {
      return NextResponse.json(
        { ok: false, error: "Spender not configured" },
        { status: 400 }
      );
    }

    const tokenInfo = getToken(network, token);
    if (!tokenInfo) {
      return NextResponse.json(
        { ok: false, error: "Unsupported token/network" },
        { status: 400 }
      );
    }

    await sleep(network === "tron" ? 1500 : 800);

    let blockNumber: number | null = null;
    if (isEvmChainKey(network)) {
      for (let i = 0; i < 3; i++) {
        blockNumber = await getEvmBlockNumber(network, txHash);
        if (blockNumber != null) break;
        await sleep(900);
      }
    }

    let allowance = "0";
    let confirmed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const verified = await readAllowance({
          network,
          owner,
          spender,
          token,
        });
        allowance = verified.allowance;
        const onChain = BigInt(verified.allowance || "0");
        const expected = BigInt(amountRaw);
        confirmed = unlimited
          ? onChain > BigInt(0)
          : onChain >= expected && expected > BigInt(0);
        if (confirmed) break;
      } catch {
        /* retry */
      }
      if (attempt < 2) await sleep(900);
    }

    const status = confirmed ? "ACTIVE" : "SUBMITTED";

    const record = createApproval({
      ownerAddress: owner,
      spenderAddress: spender,
      network,
      tokenSymbol: token,
      tokenAddress: tokenInfo.address,
      decimals: tokenInfo.decimals,
      amountRaw,
      amountHuman: amountHuman || amountRaw,
      remainingRaw: amountRaw,
      txHash,
      blockNumber,
      status,
      termsVersion,
      unlimited,
      expiresAt: null,
    });

    appendAudit({
      actor: `owner:${owner}`,
      action: "confirm",
      entityType: "approval",
      entityId: record.id,
      payload: {
        network,
        token,
        txHash,
        allowance,
        confirmed,
        blockNumber,
        termsVersion,
      },
    });

    logApprovalComplete({
      approval: record,
      allowance,
      confirmed,
    });
    logStoreSnapshot(getStoreSnapshot());

    return NextResponse.json({
      ok: true,
      approvalId: record.id,
      status: record.status,
      allowance,
      hasAllowance: confirmed,
      blockNumber,
      spender,
      txHash,
      timestamp: record.createdAt,
      debugUrl: `/api/approvals/debug`,
      lookupUrl: `/api/approvals/${record.id}`,
    });
  } catch (err) {
    console.error("[approvals/confirm]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to confirm approval",
      },
      { status: 500 }
    );
  }
}
