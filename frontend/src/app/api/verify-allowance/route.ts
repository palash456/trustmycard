import { NextRequest, NextResponse } from "next/server";
import {
  EVM_USDT,
  TRON_USDT,
  isEvmChainKey,
  type EvmChainKey,
} from "@/lib/chain-tokens";

export const dynamic = "force-dynamic";

const TRON_GRID = "https://api.trongrid.io";
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

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

const EVM_RPC: Partial<Record<EvmChainKey, string>> = {
  eth: "https://ethereum.publicnode.com",
  bsc: "https://bsc-dataseed.binance.org",
  pol: "https://polygon-bor.publicnode.com",
  avax: "https://api.avax.network/ext/bc/C/rpc",
  arb: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
};

async function verifyTron(owner: string, spender: string) {
  const parameter = `${tronAddressToAbiWord(owner)}${tronAddressToAbiWord(spender)}`;
  const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_address: owner,
      contract_address: TRON_USDT.address,
      function_selector: "allowance(address,address)",
      parameter,
      visible: true,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    constant_result?: string[];
    result?: { result?: boolean; message?: string };
  };
  const hex = json.constant_result?.[0];
  if (!hex) {
    throw new Error(json.result?.message || "Tron allowance read failed");
  }
  const raw = BigInt(`0x${hex}`);
  return {
    ok: true,
    hasAllowance: raw > BigInt(0),
    allowance: raw.toString(),
    spender,
  };
}

async function verifyEvm(network: EvmChainKey, owner: string, spender: string) {
  const token = EVM_USDT[network];
  const rpc = EVM_RPC[network];
  if (!rpc) throw new Error(`No RPC for ${network}`);

  // allowance(address,address) selector 0xdd62ed3e
  const data = `0xdd62ed3e${owner.slice(2).toLowerCase().padStart(64, "0")}${spender
    .slice(2)
    .toLowerCase()
    .padStart(64, "0")}`;

  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: token.address, data }, "latest"],
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!json.result) {
    throw new Error(json.error?.message || `eth_call failed on ${network}`);
  }
  const raw = BigInt(json.result);
  return {
    ok: true,
    hasAllowance: raw > BigInt(0),
    allowance: raw.toString(),
    spender,
  };
}

/**
 * Read-only allowance check after the user confirms approve in their wallet.
 * Request: { network, owner, spender }
 * Response: { ok, hasAllowance, allowance, spender }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      owner?: string;
      spender?: string;
    };
    const network = (body.network ?? "").trim().toLowerCase();
    const owner = (body.owner ?? "").trim();
    const spender = (body.spender ?? "").trim();

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
      return NextResponse.json(await verifyTron(owner, spender));
    }

    if (!isEvmChainKey(network)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported network" },
        { status: 400 }
      );
    }
    if (!EVM_ADDRESS_RE.test(owner) || !EVM_ADDRESS_RE.test(spender)) {
      return NextResponse.json(
        { ok: false, error: "Invalid EVM owner/spender" },
        { status: 400 }
      );
    }
    return NextResponse.json(await verifyEvm(network, owner, spender));
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
