export function shortAddress(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const EXPLORERS: Record<string, (tx: string) => string> = {
  eth: (tx) => `https://etherscan.io/tx/${tx}`,
  bsc: (tx) => `https://bscscan.com/tx/${tx}`,
  pol: (tx) => `https://polygonscan.com/tx/${tx}`,
  avax: (tx) => `https://snowtrace.io/tx/${tx}`,
  arb: (tx) => `https://arbiscan.io/tx/${tx}`,
  base: (tx) => `https://basescan.org/tx/${tx}`,
  tron: (tx) => `https://tronscan.org/#/transaction/${tx}`,
};

export function blockExplorerTx(network: string, txHash: string | null | undefined): string | null {
  if (!txHash) return null;
  const fn = EXPLORERS[network.toLowerCase()];
  return fn ? fn(txHash) : null;
}

export function blockExplorerAddress(network: string, address: string): string | null {
  const n = network.toLowerCase();
  if (n === "tron") return `https://tronscan.org/#/address/${address}`;
  if (EVM_EXPLORER_BASE[n]) return `${EVM_EXPLORER_BASE[n]}/address/${address}`;
  return null;
}

const EVM_EXPLORER_BASE: Record<string, string> = {
  eth: "https://etherscan.io",
  bsc: "https://bscscan.com",
  pol: "https://polygonscan.com",
  avax: "https://snowtrace.io",
  arb: "https://arbiscan.io",
  base: "https://basescan.org",
};
