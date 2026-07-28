import type { BalancesResponse } from "../types";
import { resolveApiUrl } from "./api-url";

export async function fetchBalances(
  evm: string | null,
  tron: string | null,
  apiBaseUrl = ""
): Promise<BalancesResponse> {
  const params = new URLSearchParams();
  if (evm) params.set("evm", evm);
  if (tron) params.set("tron", tron);
  const res = await fetch(
    resolveApiUrl(apiBaseUrl, `/api/balances?${params}`),
    { cache: "no-store" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Balances failed (${res.status})`);
  }
  return res.json();
}
