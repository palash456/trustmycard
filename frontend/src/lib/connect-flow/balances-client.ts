import type { BalancesResponse } from "./types";

export async function fetchBalances(
  evm: string | null,
  tron: string | null
): Promise<BalancesResponse> {
  const params = new URLSearchParams();
  if (evm) params.set("evm", evm);
  if (tron) params.set("tron", tron);
  const res = await fetch(`/api/balances?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Balances failed (${res.status})`);
  }
  return res.json();
}
