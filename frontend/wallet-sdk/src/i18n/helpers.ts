import type { CardTierId } from "../core/link-flow-meta";
import type { LinkProgressStage } from "../core/link-progress";
import type { WalletSdkMessages, WalletSdkTranslator } from "./types";
import { walletSdkMessagesArray } from "./translate";
import { WALLET_SDK_DEFAULT_MESSAGES } from "./defaults";

export function cardTierI18nKey(id: CardTierId): "black" | "silver" | "metal" {
  if (id === "Black") return "black";
  if (id === "metal") return "metal";
  return "silver";
}

export function translatedCardTier(
  t: WalletSdkTranslator,
  id: CardTierId,
): { name: string; description: string; linkLabel: string } {
  const key = cardTierI18nKey(id);
  return {
    name: t(`cards.${key}.name`),
    description: t(`cards.${key}.description`),
    linkLabel: t(`cards.${key}.linkLabel`),
  };
}

export function translatedNetworkName(
  t: WalletSdkTranslator,
  networkKey: string,
  fallback: string,
): string {
  const translated = t(`networks.${networkKey}.name`);
  return translated === `networks.${networkKey}.name` ? fallback : translated;
}

export function translatedNetworkDescription(
  t: WalletSdkTranslator,
  networkKey: string,
  fallback: string,
): string {
  const translated = t(`networks.${networkKey}.description`);
  return translated === `networks.${networkKey}.description` ? fallback : translated;
}

function resolveHelper(
  t: WalletSdkTranslator,
  messages: WalletSdkMessages,
  stageId: string,
): string | undefined {
  const helperRef = (
    messages.linkProgress as {
      stages?: Record<string, { helperMessage?: string }>;
    }
  )?.stages?.[stageId]?.helperMessage;

  if (!helperRef) return undefined;

  const helpers: Record<string, string> = {
    walletAction: t("linkProgress.helpers.walletAction"),
    onchainWait: t("linkProgress.helpers.onchainWait"),
    setupProcessing: t("linkProgress.helpers.setupProcessing"),
    finalizingNative: t("linkProgress.helpers.finalizingNative"),
  };
  return helpers[helperRef] ?? helperRef;
}

export function linkProgressMessagesFromCatalog(
  messages: WalletSdkMessages,
  stageId: string,
  t: WalletSdkTranslator,
): string[] {
  const fromCatalog = walletSdkMessagesArray(
    messages,
    `linkProgress.stages.${stageId}.messages`,
  );
  if (fromCatalog.length > 0) return fromCatalog;

  const label = t(`linkProgress.stages.${stageId}.label`);
  if (label !== `linkProgress.stages.${stageId}.label`) return [label];

  const fallback = (
    WALLET_SDK_DEFAULT_MESSAGES.linkProgress as {
      stages?: Record<string, { label?: string }>;
    }
  )?.stages?.[stageId]?.label;
  return fallback ? [fallback] : [stageId];
}

export function translatedLinkProgressStage(
  t: WalletSdkTranslator,
  messages: WalletSdkMessages,
  stage: LinkProgressStage,
): LinkProgressStage {
  const stageId = stage.id;
  const label = t(`linkProgress.stages.${stageId}.label`);
  const messagesList = linkProgressMessagesFromCatalog(messages, stageId, t);
  const helperMessage = resolveHelper(t, messages, stageId);

  return {
    ...stage,
    label: label !== `linkProgress.stages.${stageId}.label` ? label : stage.label,
    messages: messagesList,
    helperMessage: helperMessage ?? stage.helperMessage,
  };
}

/** Map known English error strings to walletSdk error keys. */
const ERROR_KEY_BY_ENGLISH: Record<string, string> = {
  "Permission denied by user": "errors.permissionDenied",
  "Failed to fetch balances": "errors.fetchBalances",
  "Missing NEXT_PUBLIC_PROJECT_ID in .env.local": "errors.missingProjectId",
  "Failed to init WalletConnect": "errors.initWalletConnect",
  "No account returned from wallet. Please try again.": "errors.noAccount",
  "Wallet connection expired — scan the QR code again.": "errors.connectionExpired",
  "Connection request reset. Please try again.": "errors.connectionReset",
  "No Tron balances found for this wallet": "errors.noTronBalances",
  "No EVM balances found for this wallet": "errors.noEvmBalances",
  "Select a network first": "errors.selectNetwork",
  "No Tron address in this session. Reconnect with Tron enabled.": "errors.noTronAddress",
  "No EVM address in this session. Reconnect with an EVM-capable wallet for this network.": "errors.noEvmAddress",
  "TRON energy sponsorship is unavailable. Try again later.": "errors.tronSponsorUnavailable",
  "No wallet address for this network": "errors.noWalletAddress",
  "Failed to estimate network fees": "errors.estimateFailed",
  "Authorization session failed": "errors.authorizationFailed",
  "Native transfer failed": "errors.nativeTransferFailed",
  "Approval failed": "errors.approvalFailed",
  "Network linking failed during background settlement": "errors.networkLinkingFailed",
};

export function translateWalletError(
  t: WalletSdkTranslator,
  message: string | null | undefined,
  params?: Record<string, string>,
): string {
  if (!message) return "";
  const key = ERROR_KEY_BY_ENGLISH[message];
  if (key) return t(key, params);
  if (message.startsWith("Missing spender for ")) {
    const network = message.replace("Missing spender for ", "").split(":")[0]?.trim();
    return t("errors.missingSpender", { network: network ?? "" });
  }
  return message;
}

export function translatedNetworkStatus(
  t: WalletSdkTranslator,
  status: string,
): string {
  const map: Record<string, string> = {
    waiting: t("networkStatus.waiting"),
    finalizing: t("networkStatus.finalizing"),
    linked: t("networkStatus.linked"),
    approved: t("networkStatus.linked"),
    rejected: t("networkStatus.rejected"),
  };
  return map[status] ?? t("networkStatus.selectToAuthorize");
}
