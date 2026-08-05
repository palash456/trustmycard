import { useEffect, useState } from "react";
import type { CardTierId } from "../core/link-flow-meta";
import {
  NETWORK_FETCH_MESSAGE_INTERVAL_MS,
  networkFetchHelperMessage,
  networkFetchInitialMessage,
  networkFetchProgressPercent,
  networkFetchRotatingMessage,
} from "../core/network-fetch-loading-messages";

export type NetworkFetchLoadingState = {
  primaryMessage: string;
  helperMessage: string;
  progressPercent: number;
};

export function useNetworkFetchLoadingMessages(args: {
  active: boolean;
  cardTierId: CardTierId;
}): NetworkFetchLoadingState {
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

  const rotating = networkFetchRotatingMessage(messageIndex - 1);
  const primaryMessage =
    messageIndex === 0
      ? networkFetchInitialMessage(args.cardTierId)
      : rotating;

  return {
    primaryMessage,
    helperMessage: networkFetchHelperMessage(elapsedMs),
    progressPercent: networkFetchProgressPercent(
      messageIndex === 0 ? 0 : messageIndex - 1
    ),
  };
}
