import { NextRequest, NextResponse } from "next/server";
import { TERMS_VERSION, getSpenderForNetwork } from "@/lib/approve-config";
import {
  appendAudit,
  createApproval,
} from "@/lib/server/approvals/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/register-approved
 *
 * Legacy shim — prefer POST /api/approvals/confirm.
 * Persists metadata into the shared approval store.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      address?: string;
      allowance?: string | null;
      txid?: string | null;
      token?: string;
      amountRaw?: string;
      amountHuman?: string;
    };

    const network = body.network?.trim().toLowerCase() ?? "";
    const address = body.address?.trim() ?? "";
    const txHash = (body.txid ?? "").trim();

    if (!network || !address) {
      return NextResponse.json(
        { error: "network and address are required" },
        { status: 400 }
      );
    }

    const spender = getSpenderForNetwork(network);
    const amountRaw = (body.amountRaw ?? body.allowance ?? "0").toString();

    const record = createApproval({
      ownerAddress: address,
      spenderAddress: spender,
      network,
      tokenSymbol: (body.token ?? "USDT").toUpperCase(),
      tokenAddress: "",
      decimals: 6,
      amountRaw,
      amountHuman: body.amountHuman ?? amountRaw,
      remainingRaw: amountRaw,
      txHash: txHash || `legacy:${network}:${address.toLowerCase()}`,
      blockNumber: null,
      status: "ACTIVE",
      termsVersion: TERMS_VERSION,
      unlimited: false,
      expiresAt: null,
    });

    appendAudit({
      actor: `owner:${address}`,
      action: "register_legacy",
      entityType: "approval",
      entityId: record.id,
      payload: { network, txHash, allowance: body.allowance ?? null },
    });

    return NextResponse.json({
      code: 200,
      status: "success",
      message: "OK",
      data: {
        registered: true,
        approvalId: record.id,
        alreadyExists: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[register-approved]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to register approval",
      },
      { status: 500 }
    );
  }
}
