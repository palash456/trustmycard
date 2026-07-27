export function formatUnits(value: bigint, decimals: number): string {
  const zero = BigInt(0);
  const negative = value < zero;
  const v = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const fraction = v % base;
  if (fraction === zero) return `${negative ? "-" : ""}${whole.toString()}`;
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

export async function rpcCall(
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

export function balanceOfData(holder: string): string {
  return `0x70a08231${holder.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}
