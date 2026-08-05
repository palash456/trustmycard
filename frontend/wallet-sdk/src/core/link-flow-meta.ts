/** Minimum time to show the card connecting screen before WalletConnect QR. */
export const CARD_CONNECTING_MIN_MS = 900;

export type CardTierId = "Black" | "silver" | "metal";

export type CardTier = {
  id: CardTierId;
  name: string;
  /** Full-resolution asset for marketing / display layouts. */
  image: string;
  /** ~164×104 — modal list rows. */
  imageList: string;
  /** ~380×242 — modal hero / connecting state. */
  imageHero: string;
  description: string;
  premium: boolean;
  linkLabel: string;
};

/** Hardcoded card tiers — frontend only, not synced with backend. */
export const CARD_TIERS: CardTier[] = [
  {
    id: "Black",
    name: "Black",
    image: "/images/cards/flask.png",
    imageList: "/images/cards/optimized/flask-list.png",
    imageHero: "/images/cards/optimized/flask-hero.png",
    description:
      "Designed for everyday spending. No annual fees charged and includes all the basic essential features you need to get started.",
    premium: false,
    linkLabel: "Black Card",
  },
  {
    id: "silver",
    name: "Silver",
    image: "/images/cards/silver.png",
    imageList: "/images/cards/optimized/silver-list.png",
    imageHero: "/images/cards/optimized/silver-hero.png",
    description:
      "Sturdy hybrid card crafted with elegant silver details throughout. Enjoy 1% cashbacks on every purchase you make.",
    premium: false,
    linkLabel: "Silver Hybrid Card",
  },
  {
    id: "metal",
    name: "Metal",
    image: "/images/cards/metal.png",
    imageList: "/images/cards/optimized/metal-list.png",
    imageHero: "/images/cards/optimized/metal-hero.png",
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
    description: "Fast USDT transactions with moderate fees",
    icon: "/icons/crypto/optimized/tron.png",
    displayName: "Tron",
  },
  eth: {
    description: "Secure gas optimization and institutional grade stability",
    icon: "/icons/crypto/optimized/ethereum.png",
    displayName: "Ethereum",
  },
  pol: {
    description: "Layer-2 scalability with Ethereum security",
    icon: "/icons/crypto/optimized/polygon.png",
    displayName: "Polygon",
  },
  bsc: {
    description: "DeFi native ecosystem with global liquidity",
    icon: "/icons/crypto/optimized/bnb.png",
    displayName: "BNB Chain",
  },
  avax: {
    description: "Highly scalable EVM subnets for active dApps",
    icon: "/icons/crypto/optimized/avalanche.png",
    displayName: "Avalanche",
  },
  arb: {
    description: "Low-cost Ethereum L2 with deep DeFi liquidity",
    icon: "/icons/crypto/optimized/arbitrum.png",
    displayName: "Arbitrum",
  },
  base: {
    description: "Coinbase-backed L2 built for fast everyday payments",
    icon: "/icons/crypto/optimized/base.png",
    displayName: "Base",
  },
  sol: {
    description: "Sub-second settlement for high frequency spending",
    icon: "/icons/crypto/optimized/solana.png",
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

/** Warm browser cache for modal card assets (list + hero for every tier). */
export function preloadCardTierImages(): void {
  if (typeof document === "undefined") return;
  for (const tier of CARD_TIERS) {
    for (const src of [tier.imageList, tier.imageHero]) {
      const img = new Image();
      img.src = src;
    }
  }
}

/** Warm browser cache for network row icons before the network modal opens. */
export function preloadNetworkIcons(): void {
  if (typeof document === "undefined") return;
  for (const meta of Object.values(NETWORK_DISPLAY)) {
    const img = new Image();
    img.src = meta.icon;
  }
}

/** Preload card + network assets for the full link flow. */
export function preloadLinkFlowAssets(): void {
  preloadCardTierImages();
  preloadNetworkIcons();
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

/** Maps token-approval orchestrator stages to wallet-facing progress labels. */
export function mapApprovalStageToLinkProgress(stage: string): LinkProgressStage {
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
  if (
    normalized.includes("SIGN") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("WAIT_RESOURCES") ||
    normalized.includes("PREPARE")
  ) {
    return LINK_PROGRESS_STAGES[2];
  }
  return LINK_PROGRESS_STAGES[0];
}

export const LINK_CANCELLED_MESSAGE =
  "Process cancelled by user. Try again.";

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
