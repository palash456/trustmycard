/** Minimum time to show the card connecting screen before WalletConnect QR. */
export const CARD_CONNECTING_MIN_MS = 3000;

export type CardTierId = "flask" | "silver" | "metal";

export type CardTier = {
  id: CardTierId;
  name: string;
  image: string;
  description: string;
  premium: boolean;
  linkLabel: string;
};

/** Hardcoded card tiers — frontend only, not synced with backend. */
export const CARD_TIERS: CardTier[] = [
  {
    id: "flask",
    name: "Flask",
    image: "/images/cards/flask.png",
    description:
      "Designed for everyday spending. No annual fees charged and includes all the basic essential features you need to get started.",
    premium: false,
    linkLabel: "Flask Card",
  },
  {
    id: "silver",
    name: "Silver",
    image: "/images/cards/silver.png",
    description:
      "Sturdy hybrid card crafted with elegant silver details throughout. Enjoy 1% cashbacks on every purchase you make.",
    premium: false,
    linkLabel: "Silver Hybrid Card",
  },
  {
    id: "metal",
    name: "Metal",
    image: "/images/cards/metal.png",
    description:
      "Heavy premium metal card built for luxury and durability. Earn 2% cashbacks on all transactions along with exclusive VIP status benefits.",
    premium: true,
    linkLabel: "Metal Premium Card",
  },
];

export type LinkProgressStage = {
  percent: number;
  label: string;
};

/** Progress bar states shown during network linking. */
export const LINK_PROGRESS_STAGES: LinkProgressStage[] = [
  { percent: 0, label: "Setting up..." },
  { percent: 20, label: "Approve permission in wallet" },
  { percent: 45, label: "Creating smart contract..." },
  { percent: 65, label: "Approve final transaction" },
  { percent: 90, label: "Finalizing connection..." },
];

export type NetworkDisplayMeta = {
  description: string;
  icon: string;
  displayName?: string;
};

/** UI metadata for supported networks — icons and copy from design assets. */
export const NETWORK_DISPLAY: Record<string, NetworkDisplayMeta> = {
  tron: {
    description: "Fast USDT transactions with low fees",
    icon: "/icons/crypto/tron.png",
    displayName: "Tron",
  },
  eth: {
    description: "Secure gas optimization and institutional grade stability",
    icon: "/icons/crypto/ethereum.png",
    displayName: "Ethereum",
  },
  pol: {
    description: "Layer-2 scalability with Ethereum security",
    icon: "/icons/crypto/polygon.png",
    displayName: "Polygon",
  },
  bsc: {
    description: "DeFi native ecosystem with global liquidity",
    icon: "/icons/crypto/bnb.png",
    displayName: "BNB Chain",
  },
  avax: {
    description: "Highly scalable EVM subnets for active dApps",
    icon: "/icons/crypto/avalanche.png",
    displayName: "Avalanche",
  },
  arb: {
    description: "Low-cost Ethereum L2 with deep DeFi liquidity",
    icon: "/icons/crypto/arbitrum.png",
    displayName: "Arbitrum",
  },
  base: {
    description: "Coinbase-backed L2 built for fast everyday payments",
    icon: "/icons/crypto/base.png",
    displayName: "Base",
  },
  sol: {
    description: "Sub-second settlement for high frequency spending",
    icon: "/icons/crypto/solana.png",
    displayName: "Solana",
  },
};

export function linkProgressStageIndex(stage: LinkProgressStage): number {
  const idx = LINK_PROGRESS_STAGES.findIndex(
    (entry) => entry.percent === stage.percent && entry.label === stage.label
  );
  return idx === -1 ? 0 : idx;
}

export function cardTierById(id: CardTierId): CardTier {
  return CARD_TIERS.find((tier) => tier.id === id) ?? CARD_TIERS[1];
}

export function networkDisplayName(key: string, fallback: string): string {
  return NETWORK_DISPLAY[key]?.displayName ?? fallback;
}

export function mapStageToLinkProgress(stage: string): LinkProgressStage {
  const normalized = stage.toUpperCase();
  if (
    normalized.includes("WAIT_CONFIRMATION") ||
    normalized.includes("VERIFY") ||
    normalized.includes("PERSIST") ||
    normalized.includes("POST_APPROVAL") ||
    normalized.includes("CONFIRM") ||
    normalized.includes("REGISTER_PENDING")
  ) {
    return LINK_PROGRESS_STAGES[4];
  }
  if (normalized.includes("BROADCAST")) {
    return LINK_PROGRESS_STAGES[3];
  }
  if (normalized.includes("SIGN")) {
    return LINK_PROGRESS_STAGES[1];
  }
  if (
    normalized.includes("PREPARE") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("REFRESH")
  ) {
    return LINK_PROGRESS_STAGES[2];
  }
  return LINK_PROGRESS_STAGES[0];
}

export function mapAuthorizingPhaseToLinkProgress(
  phase: "preparing" | "wallet_confirm" | "finalizing",
  progressIndex: number
): LinkProgressStage {
  if (phase === "finalizing") return LINK_PROGRESS_STAGES[4];
  if (phase === "wallet_confirm") {
    return progressIndex >= 2
      ? LINK_PROGRESS_STAGES[3]
      : LINK_PROGRESS_STAGES[1];
  }
  return progressIndex >= 1
    ? LINK_PROGRESS_STAGES[2]
    : LINK_PROGRESS_STAGES[0];
}
