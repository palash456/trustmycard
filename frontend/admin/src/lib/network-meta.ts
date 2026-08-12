export type NetworkMeta = {
  id: string;
  label: string;
  icon: string;
};

const NETWORK_META: Record<string, NetworkMeta> = {
  eth: { id: "eth", label: "ETH", icon: "/icons/networks/eth.svg" },
  bsc: { id: "bsc", label: "BSC", icon: "/icons/networks/bsc.svg" },
  pol: { id: "pol", label: "POL", icon: "/icons/networks/pol.svg" },
  polygon: { id: "pol", label: "POL", icon: "/icons/networks/pol.svg" },
  matic: { id: "pol", label: "POL", icon: "/icons/networks/pol.svg" },
  avax: { id: "avax", label: "AVAX", icon: "/icons/networks/avax.png" },
  avalanche: { id: "avax", label: "AVAX", icon: "/icons/networks/avax.png" },
  arb: { id: "arb", label: "ARB", icon: "/icons/networks/arb.svg" },
  arbitrum: { id: "arb", label: "ARB", icon: "/icons/networks/arb.svg" },
  base: { id: "base", label: "BASE", icon: "/icons/networks/base.svg" },
  tron: { id: "tron", label: "TRON", icon: "/icons/networks/tron.svg" },
  trx: { id: "tron", label: "TRON", icon: "/icons/networks/tron.svg" },
};

const FALLBACK_ICON = "/icons/networks/eth.svg";

export function resolveNetworkId(network: string): string {
  return network.trim().toLowerCase();
}

export function getNetworkMeta(network: string): NetworkMeta {
  const id = resolveNetworkId(network);
  return (
    NETWORK_META[id] ?? {
      id,
      label: id.toUpperCase(),
      icon: FALLBACK_ICON,
    }
  );
}
