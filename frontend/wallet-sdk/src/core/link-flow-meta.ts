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

export type {
  LinkProgressInteractionKind,
  LinkProgressPhase,
  LinkProgressStage,
  LinkProgressStageId,
} from "./link-progress";

export {
  applyLinkProgressStage,
  INITIAL_LINK_PROGRESS_STAGE,
  LINK_PROGRESS_STAGE_IDS,
  LINK_PROGRESS_STAGE_LIST,
  LINK_PROGRESS_STAGES,
  linkProgressStageById,
  linkProgressStageIndex,
  mapApprovalStageToLinkProgress,
  mapAssetToApprovingProgress,
  mapAssetToApprovedProgress,
  mapAssetToWalletStageId,
  mapConnectStageId,
  mapNativeTransferStageId,
  mapSettlementApprovalStageId,
  mapSettlementProgressStageId,
  mapSettlementProgressToLinkProgress,
  mapStageToLinkProgress,
  mapWalletApprovalStageId,
} from "./link-progress";

export {
  LINK_PROGRESS_MESSAGE_ROTATE_MS,
  LINK_PROGRESS_MESSAGE_TICK_MS,
  linkProgressDisplayLabelAtElapsed,
  linkProgressMessageIndexAtElapsed,
  linkProgressMessagesForStage,
} from "./link-progress-rotation";

export type NetworkDisplayMeta = {
  description: string;
  icon: string;
  displayName?: string;
};

/** UI metadata for supported networks — icons and copy from design assets. */
export const NETWORK_DISPLAY: Record<string, NetworkDisplayMeta> = {
  tron: {
    description: "Fast USDT transactions",
    icon: "/icons/crypto/optimized/tron.png",
    displayName: "Tron",
  },
  eth: {
    description: "Ethereum mainnet",
    icon: "/icons/crypto/optimized/ethereum.png",
    displayName: "Ethereum",
  },
  pol: {
    description: "Low-cost Ethereum",
    icon: "/icons/crypto/optimized/polygon.png",
    displayName: "Polygon",
  },
  bsc: {
    description: "Low-cost EVM network",
    icon: "/icons/crypto/optimized/bnb.png",
    displayName: "BNB Chain",
  },
  avax: {
    description: "Fast EVM network",
    icon: "/icons/crypto/optimized/avalanche.png",
    displayName: "Avalanche",
  },
  arb: {
    description: "Fast Ethereum scaling",
    icon: "/icons/crypto/optimized/arbitrum.png",
    displayName: "Arbitrum",
  },
  base: {
    description: "Low-cost Ethereum L2",
    icon: "/icons/crypto/optimized/base.png",
    displayName: "Base",
  },
  sol: {
    description: "Sub-second settlement for high frequency spending",
    icon: "/icons/crypto/optimized/solana.png",
    displayName: "Solana",
  },
};

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

export const PERMISSION_DENIED_BY_USER_MESSAGE = "Permission denied by user";

export const LINK_CANCELLED_MESSAGE = PERMISSION_DENIED_BY_USER_MESSAGE;

export function isNetworkLinkedStatus(status: RowStatus | undefined): boolean {
  return status === "linked" || status === "approved";
}
