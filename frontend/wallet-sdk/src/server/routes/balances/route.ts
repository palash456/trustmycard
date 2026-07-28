import { NextRequest, NextResponse } from "next/server";
import { EVM_CHAINS } from "../../balances/chains";
import { readEvmChain } from "../../balances/evm-reader";
import { readTron } from "../../balances/tron-reader";
import {
  EVM_ADDRESS_RE,
  TRON_ADDRESS_RE,
  type BalancesResponse,
} from "../../balances/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const evm = req.nextUrl.searchParams.get("evm")?.trim() || "";
  const tron = req.nextUrl.searchParams.get("tron")?.trim() || "";

  if (!evm && !tron) {
    return NextResponse.json(
      { error: "Provide at least evm or tron address" },
      { status: 400 }
    );
  }
  if (evm && !EVM_ADDRESS_RE.test(evm)) {
    return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
  }
  if (tron && !TRON_ADDRESS_RE.test(tron)) {
    return NextResponse.json({ error: "Invalid TRON address" }, { status: 400 });
  }

  const result: BalancesResponse = {};

  if (evm) {
    const entries = await Promise.all(
      EVM_CHAINS.map(
        async (chain) => [chain.key, await readEvmChain(chain, evm)] as const
      )
    );
    for (const [key, balances] of entries) result[key] = balances;
  }

  if (tron) {
    result.tron = await readTron(tron);
  }

  return NextResponse.json(result);
}
