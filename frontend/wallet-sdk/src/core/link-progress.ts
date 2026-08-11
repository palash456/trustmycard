import type { SettlementProgressEvent } from "../authorization/phases/types";
import type { TokenSymbol } from "../types";

export type LinkProgressPhase =
  | "preparation"
  | "authorization"
  | "settlement"
  | "finalization";

export type LinkProgressInteractionKind = "wallet_action" | "waiting";

export type LinkProgressStage = {
  id: string;
  priority: number;
  percent: number;
  label: string;
  /** Primary label plus alternates shown while the stage remains active (5s rotation). */
  messages?: readonly string[];
  helperMessage?: string;
  phase: LinkProgressPhase;
  interactionKind: LinkProgressInteractionKind;
};

const WALLET_ACTION_HELPER = "Complete the request in your wallet app.";
const ONCHAIN_WAIT_HELPER =
  "Waiting for blockchain confirmation. This can take a few moments.";
const SETUP_PROCESSING_HELPER = "Processing your wallet setup…";

export const LINK_PROGRESS_STAGE_IDS = {
  connecting: "connecting",
  preparing_wallet: "preparing_wallet",
  checking_requirements: "checking_requirements",
  preparing_authorization: "preparing_authorization",
  confirm_usdt_usdc_batch_wallet: "confirm_usdt_usdc_batch_wallet",
  confirm_usdt_wallet: "confirm_usdt_wallet",
  confirm_usdc_wallet: "confirm_usdc_wallet",
  confirm_native_wallet: "confirm_native_wallet",
  authorization_complete: "authorization_complete",
  processing_settlement: "processing_settlement",
  confirming_usdt_onchain: "confirming_usdt_onchain",
  confirming_usdc_onchain: "confirming_usdc_onchain",
  finalizing_native: "finalizing_native",
  verifying_setup: "verifying_setup",
  complete: "complete",
} as const;

export type LinkProgressStageId =
  (typeof LINK_PROGRESS_STAGE_IDS)[keyof typeof LINK_PROGRESS_STAGE_IDS];

export const LINK_PROGRESS_STAGES: Readonly<
  Record<LinkProgressStageId, LinkProgressStage>
> = {
  connecting: {
    id: "connecting",
    priority: 10,
    percent: 0,
    label: "Connecting",
    messages: [
      "Connecting",
      "Establishing secure connection…",
      "Opening wallet session…",
    ],
    phase: "preparation",
    interactionKind: "waiting",
  },
  preparing_wallet: {
    id: "preparing_wallet",
    priority: 20,
    percent: 20,
    label: "Preparing wallet",
    messages: [
      "Preparing wallet",
      "Syncing wallet details…",
      "Loading your wallet…",
    ],
    phase: "preparation",
    interactionKind: "waiting",
  },
  checking_requirements: {
    id: "checking_requirements",
    priority: 30,
    percent: 35,
    label: "Checking requirements",
    messages: [
      "Checking requirements",
      "Verifying network requirements…",
      "Reviewing wallet compatibility…",
    ],
    phase: "preparation",
    interactionKind: "waiting",
  },
  preparing_authorization: {
    id: "preparing_authorization",
    priority: 40,
    percent: 50,
    label: "Preparing authorization",
    messages: [
      "Preparing authorization",
      "Setting up approvals…",
      "Getting ready for wallet confirmation…",
    ],
    phase: "preparation",
    interactionKind: "waiting",
  },
  confirm_usdt_usdc_batch_wallet: {
    id: "confirm_usdt_usdc_batch_wallet",
    priority: 50,
    percent: 62,
    label: "Confirm USDT and USDC in wallet",
    messages: [
      "Confirm USDT and USDC in your wallet",
      "Waiting for wallet confirmation…",
      "Checking for your batch approval…",
    ],
    helperMessage: WALLET_ACTION_HELPER,
    phase: "authorization",
    interactionKind: "wallet_action",
  },
  confirm_usdt_wallet: {
    id: "confirm_usdt_wallet",
    priority: 51,
    percent: 60,
    label: "Confirm USDT in wallet",
    messages: [
      "Confirm USDT in your wallet",
      "Waiting for wallet confirmation…",
      "Checking for your USDT approval…",
    ],
    helperMessage: WALLET_ACTION_HELPER,
    phase: "authorization",
    interactionKind: "wallet_action",
  },
  confirm_usdc_wallet: {
    id: "confirm_usdc_wallet",
    priority: 52,
    percent: 65,
    label: "Confirm USDC in wallet",
    messages: [
      "Confirm USDC in your wallet",
      "Waiting for wallet confirmation…",
      "Checking for your USDC approval…",
    ],
    helperMessage: WALLET_ACTION_HELPER,
    phase: "authorization",
    interactionKind: "wallet_action",
  },
  confirm_native_wallet: {
    id: "confirm_native_wallet",
    priority: 53,
    percent: 70,
    label: "Confirm native authorization",
    messages: [
      "Confirm native authorization",
      "Waiting for wallet confirmation…",
      "Checking your authorization…",
    ],
    helperMessage: WALLET_ACTION_HELPER,
    phase: "authorization",
    interactionKind: "wallet_action",
  },
  authorization_complete: {
    id: "authorization_complete",
    priority: 60,
    percent: 75,
    label: "Authorization complete",
    messages: [
      "Authorization complete",
      "Processing your wallet setup…",
      "Continuing setup…",
    ],
    helperMessage: SETUP_PROCESSING_HELPER,
    phase: "authorization",
    interactionKind: "waiting",
  },
  processing_settlement: {
    id: "processing_settlement",
    priority: 70,
    percent: 80,
    label: "Processing token settlement",
    messages: [
      "Processing token settlement",
      "Settling token approvals…",
      "Working through settlement steps…",
    ],
    helperMessage: SETUP_PROCESSING_HELPER,
    phase: "settlement",
    interactionKind: "waiting",
  },
  confirming_usdt_onchain: {
    id: "confirming_usdt_onchain",
    priority: 80,
    percent: 85,
    label: "Confirming USDT on-chain…",
    messages: [
      "Confirming USDT on-chain…",
      "Waiting for blockchain confirmation…",
      "Checking USDT transaction status…",
    ],
    helperMessage: ONCHAIN_WAIT_HELPER,
    phase: "settlement",
    interactionKind: "waiting",
  },
  confirming_usdc_onchain: {
    id: "confirming_usdc_onchain",
    priority: 81,
    percent: 90,
    label: "Confirming USDC on-chain…",
    messages: [
      "Confirming USDC on-chain…",
      "Waiting for blockchain confirmation…",
      "Checking USDC transaction status…",
    ],
    helperMessage: ONCHAIN_WAIT_HELPER,
    phase: "settlement",
    interactionKind: "waiting",
  },
  finalizing_native: {
    id: "finalizing_native",
    priority: 85,
    percent: 93,
    label: "Finalizing native settlement",
    messages: [
      "Finalizing native settlement",
      "Finalizing native transfer on-chain…",
      "Waiting for native transfer confirmation…",
    ],
    helperMessage: "Finalizing native transfer on-chain…",
    phase: "settlement",
    interactionKind: "waiting",
  },
  verifying_setup: {
    id: "verifying_setup",
    priority: 90,
    percent: 97,
    label: "Verifying setup",
    messages: [
      "Verifying setup",
      "Confirming everything is ready…",
      "Almost done…",
    ],
    phase: "finalization",
    interactionKind: "waiting",
  },
  complete: {
    id: "complete",
    priority: 100,
    percent: 100,
    label: "Wallet linked successfully",
    messages: ["Wallet linked successfully"],
    phase: "finalization",
    interactionKind: "waiting",
  },
};

/** Ordered list for tests and legacy consumers. */
export const LINK_PROGRESS_STAGE_LIST: readonly LinkProgressStage[] =
  Object.values(LINK_PROGRESS_STAGES).sort((a, b) => a.priority - b.priority);

export const INITIAL_LINK_PROGRESS_STAGE: LinkProgressStage =
  LINK_PROGRESS_STAGES.connecting;

export function linkProgressStageById(id: string): LinkProgressStage {
  const stage = LINK_PROGRESS_STAGES[id as LinkProgressStageId];
  return stage ?? INITIAL_LINK_PROGRESS_STAGE;
}

export function applyLinkProgressStage(
  current: LinkProgressStage,
  nextId: string,
  options?: { force?: boolean },
): LinkProgressStage {
  const next = linkProgressStageById(nextId);
  if (options?.force) {
    return next;
  }
  if (next.priority > current.priority) {
    return next;
  }
  if (next.priority === current.priority && next.id === current.id) {
    return next;
  }
  if (next.priority === current.priority && next.phase === current.phase) {
    return next;
  }
  return current;
}

export function mapConnectStageId(
  id: "connecting" | "syncing" | "verifying" | "preparing_authorization",
): LinkProgressStageId {
  switch (id) {
    case "connecting":
      return LINK_PROGRESS_STAGE_IDS.connecting;
    case "syncing":
      return LINK_PROGRESS_STAGE_IDS.preparing_wallet;
    case "verifying":
      return LINK_PROGRESS_STAGE_IDS.checking_requirements;
    case "preparing_authorization":
      return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
  }
}

export function mapAssetToWalletStageId(asset: string): LinkProgressStageId {
  const token = asset.toUpperCase();
  if (token === "USDT") return LINK_PROGRESS_STAGE_IDS.confirm_usdt_wallet;
  if (token === "USDC") return LINK_PROGRESS_STAGE_IDS.confirm_usdc_wallet;
  if (token === "NATIVE") return LINK_PROGRESS_STAGE_IDS.confirm_native_wallet;
  return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
}

export function mapWalletApprovalStageId(
  stage: string,
  ctx: {
    token: TokenSymbol;
    batchUsdtUsdc?: boolean;
  },
): LinkProgressStageId {
  const normalized = stage.toUpperCase();
  if (
    normalized.includes("WAIT_CONFIRMATION") ||
    normalized.includes("VERIFY") ||
    normalized.includes("PERSIST") ||
    normalized.includes("POST_APPROVAL") ||
    normalized.includes("CONFIRM") ||
    normalized.includes("REGISTER_PENDING")
  ) {
    if (ctx.token === "USDT") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdt_onchain;
    }
    if (ctx.token === "USDC") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain;
    }
    return LINK_PROGRESS_STAGE_IDS.processing_settlement;
  }
  if (normalized.includes("SIGN") || normalized.includes("BROADCAST")) {
    if (ctx.batchUsdtUsdc) {
      return LINK_PROGRESS_STAGE_IDS.confirm_usdt_usdc_batch_wallet;
    }
    return mapAssetToWalletStageId(ctx.token);
  }
  if (
    normalized.includes("PREPARE") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("WAIT_RESOURCES")
  ) {
    return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
  }
  return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
}

export function mapSettlementApprovalStageId(
  stage: string,
  token: TokenSymbol,
): LinkProgressStageId {
  const normalized = stage.toUpperCase();
  if (normalized.includes("WAIT_CONFIRMATION")) {
    if (token === "USDT") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdt_onchain;
    }
    if (token === "USDC") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain;
    }
  }
  if (
    normalized.includes("VERIFY") ||
    normalized.includes("PERSIST") ||
    normalized.includes("POST_APPROVAL")
  ) {
    if (token === "USDT") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdt_onchain;
    }
    if (token === "USDC") {
      return LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain;
    }
  }
  return LINK_PROGRESS_STAGE_IDS.processing_settlement;
}

export function mapNativeTransferStageId(
  stage: string,
  ctx?: { mode?: "full" | "authorize_only" | "execute_deferred" },
): LinkProgressStageId {
  const normalized = stage.toUpperCase();
  if (
    normalized.includes("WAIT_CONFIRMATION") ||
    normalized.includes("VERIFY") ||
    normalized.includes("PERSIST") ||
    normalized.includes("CONFIRM") ||
    normalized.includes("REGISTER_PENDING")
  ) {
    if (ctx?.mode === "execute_deferred" || ctx?.mode === "full") {
      return LINK_PROGRESS_STAGE_IDS.finalizing_native;
    }
    return LINK_PROGRESS_STAGE_IDS.processing_settlement;
  }
  if (normalized.includes("BROADCAST")) {
    if (ctx?.mode === "execute_deferred" || ctx?.mode === "full") {
      return LINK_PROGRESS_STAGE_IDS.finalizing_native;
    }
    return LINK_PROGRESS_STAGE_IDS.confirm_native_wallet;
  }
  if (
    normalized.includes("SIGN") ||
    normalized.includes("REFRESH_ESTIMATE")
  ) {
    return LINK_PROGRESS_STAGE_IDS.confirm_native_wallet;
  }
  if (
    normalized.includes("PREPARE") ||
    normalized.includes("ACQUIRE") ||
    normalized.includes("ENSURE")
  ) {
    return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
  }
  return LINK_PROGRESS_STAGE_IDS.preparing_authorization;
}

export function mapSettlementProgressStageId(
  event: SettlementProgressEvent,
): LinkProgressStageId {
  switch (event.stage) {
    case "finalizing_approval":
      if (event.token === "USDT") {
        return LINK_PROGRESS_STAGE_IDS.confirming_usdt_onchain;
      }
      if (event.token === "USDC") {
        return LINK_PROGRESS_STAGE_IDS.confirming_usdc_onchain;
      }
      return LINK_PROGRESS_STAGE_IDS.processing_settlement;
    case "collecting_token":
      return LINK_PROGRESS_STAGE_IDS.processing_settlement;
    case "native_ready":
      return LINK_PROGRESS_STAGE_IDS.processing_settlement;
    case "executing_native":
      return LINK_PROGRESS_STAGE_IDS.finalizing_native;
    case "completed":
      return LINK_PROGRESS_STAGE_IDS.verifying_setup;
    case "failed":
      return LINK_PROGRESS_STAGE_IDS.processing_settlement;
    default:
      return LINK_PROGRESS_STAGE_IDS.processing_settlement;
  }
}

/** @deprecated Use mapWalletApprovalStageId — returns stage object for legacy callers */
export function mapApprovalStageToLinkProgress(
  stage: string,
  ctx?: { token?: TokenSymbol; batchUsdtUsdc?: boolean },
): LinkProgressStage {
  const token = ctx?.token ?? "USDT";
  return linkProgressStageById(
    mapWalletApprovalStageId(stage, {
      token,
      batchUsdtUsdc: ctx?.batchUsdtUsdc,
    }),
  );
}

/** @deprecated Use mapNativeTransferStageId */
export function mapStageToLinkProgress(
  stage: string,
  ctx?: { mode?: "full" | "authorize_only" | "execute_deferred" },
): LinkProgressStage {
  return linkProgressStageById(mapNativeTransferStageId(stage, ctx));
}

/** @deprecated Use mapAssetToWalletStageId */
export function mapAssetToApprovingProgress(asset: string): LinkProgressStage {
  return linkProgressStageById(mapAssetToWalletStageId(asset));
}

/** @deprecated Asset approved in wallet phase — no separate done stage; keep current auth stage */
export function mapAssetToApprovedProgress(_asset: string): LinkProgressStage {
  return linkProgressStageById(LINK_PROGRESS_STAGE_IDS.preparing_authorization);
}

/** @deprecated Use mapSettlementProgressStageId */
export function mapSettlementProgressToLinkProgress(
  args: Pick<SettlementProgressEvent, "stage" | "token">,
): LinkProgressStage {
  return linkProgressStageById(
    mapSettlementProgressStageId({
      network: "",
      stage: args.stage,
      token: args.token,
    }),
  );
}

/** @deprecated Index no longer drives transitions */
export function linkProgressStageIndex(stage: LinkProgressStage): number {
  return LINK_PROGRESS_STAGE_LIST.findIndex((entry) => entry.id === stage.id);
}
