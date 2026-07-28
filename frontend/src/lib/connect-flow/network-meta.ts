import type { BalancesResponse, NetworkRow, RowStatus } from "./types";

export const NETWORK_META: Record<
  string,
  { name: string; standard: string; color: string; letter: string }
> = {
  tron: { name: "Tron", standard: "TRC-20", color: "#FF0013", letter: "T" },
  eth: { name: "Ethereum", standard: "ERC-20", color: "#627EEA", letter: "Ξ" },
  bsc: { name: "BSC", standard: "BEP-20", color: "#F0B90B", letter: "B" },
  pol: { name: "Polygon", standard: "ERC-20", color: "#8247E5", letter: "P" },
  avax: { name: "Avalanche", standard: "ERC-20", color: "#E84142", letter: "A" },
  arb: { name: "Arbitrum", standard: "ERC-20", color: "#12AAFF", letter: "A" },
  base: { name: "Base", standard: "ERC-20", color: "#0052FF", letter: "B" },
};

export const DISPLAY_ORDER = [
  "tron",
  "eth",
  "bsc",
  "pol",
  "avax",
  "arb",
  "base",
] as const;

export function rowsFromBalances(data: BalancesResponse): NetworkRow[] {
  return Object.keys(data)
    .sort((a, b) => {
      const ai = DISPLAY_ORDER.indexOf(a as (typeof DISPLAY_ORDER)[number]);
      const bi = DISPLAY_ORDER.indexOf(b as (typeof DISPLAY_ORDER)[number]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map((key) => {
      const meta = NETWORK_META[key] ?? {
        name: key.toUpperCase(),
        standard: "Token",
        color: "#52525b",
        letter: key.slice(0, 1).toUpperCase(),
      };
      return { key, ...meta, balances: data[key] };
    });
}

export function statusLabel(status: RowStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting for wallet confirmation...";
    case "finalizing":
      return "Verifying on-chain allowance...";
    case "approved":
      return "Authorization recorded";
    case "rejected":
      return "Permission denied by user";
    default:
      return "Select to authorize spending";
  }
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
