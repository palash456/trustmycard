import { NextRequest, NextResponse } from "next/server";
import {
  appendAudit,
  createTransfer,
  getApproval,
  getTransferByIdempotency,
  updateTransfer,
} from "../../../approvals/store";
import { readAllowance } from "../../../approvals/read-allowance";
import {
  getToken,
  isEvmChainKey,
  type EvmChainKey,
  type TokenSymbol,
} from "../../../../core/chain-tokens";
import { EVM_RPC } from "../../../approvals/read-allowance";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/transfer
 *
 * Admin executes transferFrom(owner, to, amount) after rechecking
 * allowance and balance. Requires ADMIN_API_KEY header.
 *
 * NOTE: Actual chain broadcast requires ADMIN_EVM_PRIVATE_KEY /
 * ADMIN_TRON_PRIVATE_KEY in server env (never NEXT_PUBLIC).
 * Without keys, this endpoint validates and returns a dry-run plan.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-admin-api-key")?.trim() ?? "";
    const expected = (process.env.ADMIN_API_KEY ?? "").trim();
    if (!expected || apiKey !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      approvalId?: string;
      amountRaw?: string;
      escrowIntentId?: string;
      idempotencyKey?: string;
      toAddress?: string;
      execute?: boolean;
    };

    const approvalId = (body.approvalId ?? "").trim();
    const amountRaw = (body.amountRaw ?? "").trim();
    const idempotencyKey = (body.idempotencyKey ?? "").trim();
    const toAddress = (body.toAddress ?? "").trim();
    const execute = Boolean(body.execute);

    if (!approvalId || !amountRaw || !idempotencyKey || !toAddress) {
      return NextResponse.json(
        {
          error:
            "approvalId, amountRaw, idempotencyKey, and toAddress are required",
        },
        { status: 400 }
      );
    }

    const existing = getTransferByIdempotency(idempotencyKey);
    if (existing) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        transfer: existing,
      });
    }

    const approval = getApproval(approvalId);
    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }
    if (
      approval.status !== "ACTIVE" &&
      approval.status !== "PARTIALLY_USED"
    ) {
      return NextResponse.json(
        { error: `Approval status ${approval.status} cannot transfer` },
        { status: 422 }
      );
    }

    let requested: bigint;
    try {
      requested = BigInt(amountRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid amountRaw" },
        { status: 400 }
      );
    }
    if (requested <= BigInt(0)) {
      return NextResponse.json(
        { error: "amount must be > 0" },
        { status: 400 }
      );
    }

    const remaining = BigInt(approval.remainingRaw);
    const token = approval.tokenSymbol as TokenSymbol;

    const onChain = await readAllowance({
      network: approval.network,
      owner: approval.ownerAddress,
      spender: approval.spenderAddress,
      token,
    });
    const allowance = BigInt(onChain.allowance);

    // balanceOf check
    let balance = BigInt(0);
    try {
      balance = await readTokenBalance(
        approval.network,
        approval.ownerAddress,
        token
      );
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to read balance",
        },
        { status: 502 }
      );
    }

    const maxSpend = [requested, remaining, allowance, balance].reduce(
      (a, b) => (a < b ? a : b)
    );

    if (maxSpend <= BigInt(0) || maxSpend < requested) {
      appendAudit({
        actor: "admin",
        action: "transfer_rejected",
        entityType: "approval",
        entityId: approvalId,
        payload: {
          requested: amountRaw,
          remaining: remaining.toString(),
          allowance: allowance.toString(),
          balance: balance.toString(),
        },
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Insufficient allowance, balance, or remaining approval",
          checks: {
            requested: amountRaw,
            remaining: remaining.toString(),
            allowance: allowance.toString(),
            balance: balance.toString(),
          },
        },
        { status: 422 }
      );
    }

    const transfer = createTransfer({
      approvalId,
      escrowIntentId: body.escrowIntentId?.trim() || null,
      idempotencyKey,
      amountRaw: requested.toString(),
      fromAddress: approval.ownerAddress,
      toAddress,
      txHash: null,
      blockNumber: null,
      status: "pending",
      errorMessage: null,
    });

    if (!execute) {
      appendAudit({
        actor: "admin",
        action: "transfer_dry_run",
        entityType: "transfer",
        entityId: transfer.id,
        payload: {
          approvalId,
          amountRaw: requested.toString(),
          toAddress,
        },
      });

      const { flowLog } = await import("../../../approvals/flow-logger");
      flowLog("ADMIN TRANSFER DRY-RUN (NO FUNDS MOVED YET)", {
        fundsMoved: "NO — dry run only",
        approvalId,
        transferId: transfer.id,
        amountRaw: requested.toString(),
        toAddress,
        remaining: remaining.toString(),
        allowance: allowance.toString(),
        balance: balance.toString(),
      });

      return NextResponse.json({
        ok: true,
        dryRun: true,
        transfer,
        checks: {
          remaining: remaining.toString(),
          allowance: allowance.toString(),
          balance: balance.toString(),
        },
        message:
          "Checks passed. Set execute:true and configure ADMIN_*_PRIVATE_KEY to broadcast transferFrom.",
      });
    }

    const evmKey = (process.env.ADMIN_EVM_PRIVATE_KEY ?? "").trim();
    const tronKey = (process.env.ADMIN_TRON_PRIVATE_KEY ?? "").trim();

    if (approval.network === "tron" && !tronKey) {
      updateTransfer(transfer.id, {
        status: "failed",
        errorMessage: "ADMIN_TRON_PRIVATE_KEY not configured",
      });
      return NextResponse.json(
        {
          error:
            "ADMIN_TRON_PRIVATE_KEY required to execute Tron transferFrom",
        },
        { status: 501 }
      );
    }
    if (approval.network !== "tron" && !evmKey) {
      updateTransfer(transfer.id, {
        status: "failed",
        errorMessage: "ADMIN_EVM_PRIVATE_KEY not configured",
      });
      return NextResponse.json(
        {
          error:
            "ADMIN_EVM_PRIVATE_KEY required to execute EVM transferFrom",
        },
        { status: 501 }
      );
    }

    // Execution placeholder: keys present but broadcaster not wired with a
    // signing library in this package yet. Record intent + refuse unsafe raw send.
    updateTransfer(transfer.id, {
      status: "failed",
      errorMessage:
        "transferFrom broadcaster not yet wired — install viem/tronweb and implement signer",
    });
    appendAudit({
      actor: "admin",
      action: "transfer_blocked",
      entityType: "transfer",
      entityId: transfer.id,
      payload: {
        reason: "signer_not_wired",
        network: approval.network,
        amountRaw: requested.toString(),
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Admin signer keys detected but transferFrom broadcast is not wired yet. Checks passed; wire viem/tronweb next.",
        transfer: getTransferByIdempotency(idempotencyKey),
        checks: {
          remaining: remaining.toString(),
          allowance: allowance.toString(),
          balance: balance.toString(),
        },
      },
      { status: 501 }
    );
  } catch (err) {
    console.error("[admin/transfer]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Transfer failed",
      },
      { status: 500 }
    );
  }
}

async function readTokenBalance(
  network: string,
  owner: string,
  token: TokenSymbol
): Promise<bigint> {
  const info = getToken(network, token);
  if (!info) throw new Error("Unknown token");

  if (network === "tron") {
    const res = await fetch(
      `https://api.trongrid.io/v1/accounts/${owner}`,
      { cache: "no-store" }
    );
    if (!res.ok) return BigInt(0);
    const json = (await res.json()) as {
      data?: Array<{ trc20?: Array<Record<string, string>> }>;
    };
    for (const entry of json.data?.[0]?.trc20 ?? []) {
      if (entry[info.address] !== undefined) {
        return BigInt(entry[info.address]);
      }
    }
    return BigInt(0);
  }

  if (!isEvmChainKey(network)) throw new Error("Unsupported network");
  const rpc = EVM_RPC[network as EvmChainKey];
  if (!rpc) throw new Error("No RPC");

  const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, "0")}`;
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: info.address, data }, "latest"],
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: string };
  if (!json.result) return BigInt(0);
  return BigInt(json.result);
}
