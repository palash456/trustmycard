import type { EvmChainConfig, TokenBalances } from "./types";
import { balanceOfData, formatUnits, rpcCall } from "./rpc";

export async function readErc20(
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

export async function readEvmChain(
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
