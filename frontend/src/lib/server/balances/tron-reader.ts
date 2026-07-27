import { TRON_USDT } from "./chains";
import type { TokenBalances } from "./types";
import { formatUnits } from "./rpc";

export async function readTron(address: string): Promise<TokenBalances> {
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

    let usdtRaw = BigInt(0);
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
