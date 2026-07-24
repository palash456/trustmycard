import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TokenBalances = {
  native: string;
  usdt: string;
  usdc?: string;
};

type BalancesResponse = Record<string, TokenBalances>;

type EvmChainConfig = {
  key: string;
  rpc: string[];
  nativeDecimals: number;
  usdt?: { address: string; decimals: number };
  usdc?: { address: string; decimals: number };
};

/** Supported card networks — same coverage as the working scan. */
const EVM_CHAINS: EvmChainConfig[] = [
  {
    key: "eth",
    rpc: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
    nativeDecimals: 18,
    usdt: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    usdc: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
  },
  {
    key: "bsc",
    rpc: ["https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
    nativeDecimals: 18,
    usdt: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    usdc: {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
  },
  {
    key: "pol",
    rpc: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
    nativeDecimals: 18,
    usdt: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
    usdc: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
  },
  {
    key: "avax",
    rpc: [
      "https://avalanche-c-chain.publicnode.com",
      "https://api.avax.network/ext/bc/C/rpc",
    ],
    nativeDecimals: 18,
    usdt: {
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6,
    },
    usdc: {
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
  },
  {
    key: "arb",
    rpc: ["https://arbitrum-one.publicnode.com", "https://1rpc.io/arb"],
    nativeDecimals: 18,
    usdt: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    usdc: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
  },
  {
    key: "base",
    rpc: ["https://base.publicnode.com", "https://1rpc.io/base"],
    nativeDecimals: 18,
    usdt: {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
    usdc: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
  },
];

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const fraction = v % base;
  if (fraction === 0n) return `${negative ? "-" : ""}${whole.toString()}`;
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

async function rpcCall(
  rpc: string,
  method: string,
  params: unknown[]
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    const json = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message);
    return json.result ?? "0x0";
  } finally {
    clearTimeout(timer);
  }
}

function balanceOfData(holder: string): string {
  return `0x70a08231${holder.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

async function readErc20(
  rpcs: string[],
  token: string,
  holder: string,
  decimals: number
): Promise<string> {
  for (const rpc of rpcs) {
    try {
      const raw = await rpcCall(rpc, "eth_call", [
        { to: token, data: balanceOfData(holder) },
        "latest",
      ]);
      return formatUnits(BigInt(raw), decimals);
    } catch {
      // try next rpc
    }
  }
  return "0";
}

async function readEvmChain(
  chain: EvmChainConfig,
  address: string
): Promise<TokenBalances> {
  let native = "0";
  for (const rpc of chain.rpc) {
    try {
      const hex = await rpcCall(rpc, "eth_getBalance", [address, "latest"]);
      native = formatUnits(BigInt(hex), chain.nativeDecimals);
      break;
    } catch {
      // try next
    }
  }

  const [usdt, usdc] = await Promise.all([
    chain.usdt
      ? readErc20(chain.rpc, chain.usdt.address, address, chain.usdt.decimals)
      : Promise.resolve("0"),
    chain.usdc
      ? readErc20(chain.rpc, chain.usdc.address, address, chain.usdc.decimals)
      : Promise.resolve(undefined),
  ]);

  const out: TokenBalances = { native, usdt };
  if (usdc !== undefined) out.usdc = usdc;
  return out;
}

async function readTron(address: string): Promise<TokenBalances> {
  try {
    const res = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
      cache: "no-store",
    });
    if (!res.ok) return { native: "0", usdt: "0" };
    const json = (await res.json()) as {
      data?: Array<{
        balance?: number;
        trc20?: Array<Record<string, string>>;
      }>;
    };
    const account = json.data?.[0];
    const native = formatUnits(BigInt(account?.balance ?? 0), 6);

    let usdtRaw = 0n;
    for (const entry of account?.trc20 ?? []) {
      if (entry[TRON_USDT] !== undefined) {
        usdtRaw = BigInt(entry[TRON_USDT]);
        break;
      }
    }

    return { native, usdt: formatUnits(usdtRaw, 6) };
  } catch {
    return { native: "0", usdt: "0" };
  }
}

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
