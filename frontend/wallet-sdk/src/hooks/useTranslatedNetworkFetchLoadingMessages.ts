import { useEffect, useState } from "react";
import type { CardTierId } from "../core/link-flow-meta";
import {
  NETWORK_FETCH_MESSAGE_INTERVAL_MS,
  NETWORK_FETCH_LONG_WAIT_MS,
  networkFetchProgressPercent,
} from "../core/network-fetch-loading-messages";
import { useWalletSdkMessagesArray, useWalletSdkT } from "../i18n/context";
import { cardTierI18nKey } from "../i18n/helpers";

export type NetworkFetchLoadingState = {
  primaryMessage: string;
  helperMessage: string;
  progressPercent: number;
};

export function useTranslatedNetworkFetchLoadingMessages(args: {
  active: boolean;
  cardTierId: CardTierId;
}): NetworkFetchLoadingState {
  const t = useWalletSdkT();
  const rotating = useWalletSdkMessagesArray("overlay.fetch.rotating");
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!args.active) {
      setMessageIndex(0);
      setElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    setMessageIndex(0);
    setElapsedMs(0);

    const tickMs = 1_000;
    const elapsedTimer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, tickMs);

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => prev + 1);
    }, NETWORK_FETCH_MESSAGE_INTERVAL_MS);

    return () => {
      clearInterval(elapsedTimer);
      clearInterval(messageTimer);
    };
  }, [args.active, args.cardTierId]);

  const cardKey = cardTierI18nKey(args.cardTierId);
  const cardName = t(`cards.${cardKey}.name`);

  const rotatingMessages =
    rotating.length > 0 ? rotating : ["Fetching network information..."];

  const primaryMessage =
    messageIndex === 0
      ? t("overlay.fetch.initial", { card: cardName })
      : rotatingMessages[
          (((messageIndex - 1) % rotatingMessages.length) +
            rotatingMessages.length) %
            rotatingMessages.length
        ];

  const helperMessage =
    elapsedMs >= NETWORK_FETCH_LONG_WAIT_MS
      ? t("overlay.fetch.helperLongWait")
      : t("overlay.fetch.helperInitial");

  return {
    primaryMessage,
    helperMessage,
    progressPercent: networkFetchProgressPercent(
      messageIndex === 0 ? 0 : messageIndex - 1,
    ),
  };
}
