import {
  getToken,
  isEvmChainKey,
  type EvmChainKey,
  type TokenSymbol,
} from "@/lib/chain-tokens";

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

const EVM_RPC: Partial<Record<EvmChainKey, string>> = {
  eth: "https://ethereum.publicnode.com",
  bsc: "https://bsc-dataseed.binance.org",
  pol: "https://polygon-bor.publicnode.com",
  avax: "https://api.avax.network/ext/bc/C/rpc",
  arb: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
};

export type AllowanceResult = {
  ok: true;
  hasAllowance: boolean;
  allowance: string;
  spender: string;
  token: TokenSymbol;
  tokenAddress: string;
};

async function verifyTron(
  owner: string,
  spender: string,
  tokenSymbol: TokenSymbol
): Promise<AllowanceResult> {
  const token = getToken("tron", tokenSymbol);
  if (!token) throw new Error(`Unsupported Tron token ${tokenSymbol}`);

  const parameter = `${tronAddressToAbiWord(owner)}${tronAddressToAbiWord(spender)}`;
  const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner_address: owner,
      contract_address: token.address,
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
    token: token.symbol,
    tokenAddress: token.address,
  };
}

async function verifyEvm(
  network: EvmChainKey,
  owner: string,
  spender: string,
  tokenSymbol: TokenSymbol
): Promise<AllowanceResult> {
  const token = getToken(network, tokenSymbol);
  const rpc = EVM_RPC[network];
  if (!token || !rpc) throw new Error(`No token/RPC for ${network}`);

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
  const json = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (!json.result) {
    throw new Error(json.error?.message || `eth_call failed on ${network}`);
  }
  const raw = BigInt(json.result);
  return {
    ok: true,
    hasAllowance: raw > BigInt(0),
    allowance: raw.toString(),
    spender,
    token: token.symbol,
    tokenAddress: token.address,
  };
}

export async function readAllowance(args: {
  network: string;
  owner: string;
  spender: string;
  token: TokenSymbol;
}): Promise<AllowanceResult> {
  if (args.network === "tron") {
    return verifyTron(args.owner, args.spender, args.token);
  }
  if (!isEvmChainKey(args.network)) {
    throw new Error("Unsupported network");
  }
  return verifyEvm(args.network, args.owner, args.spender, args.token);
}

export { EVM_RPC };
