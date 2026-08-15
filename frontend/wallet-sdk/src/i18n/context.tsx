"use client";

import { createContext, useContext } from "react";
import type { WalletSdkMessages, WalletSdkTranslator } from "./types";
import {
  createWalletSdkTranslator,
  walletSdkMessagesArray,
  deepMergeMessages,
} from "./translate";
import { WALLET_SDK_DEFAULT_MESSAGES } from "./defaults";

const WalletSdkI18nContext = createContext<WalletSdkTranslator | null>(null);
const WalletSdkMessagesContext = createContext<WalletSdkMessages>(
  WALLET_SDK_DEFAULT_MESSAGES,
);

export function WalletSdkI18nProvider({
  messages,
  children,
}: {
  messages?: WalletSdkMessages;
  children: React.ReactNode;
}) {
  const resolvedMessages = deepMergeMessages(
    WALLET_SDK_DEFAULT_MESSAGES,
    messages,
  );
  const translator = createWalletSdkTranslator(resolvedMessages);

  return (
    <WalletSdkMessagesContext.Provider value={resolvedMessages}>
      <WalletSdkI18nContext.Provider value={translator}>
        {children}
      </WalletSdkI18nContext.Provider>
    </WalletSdkMessagesContext.Provider>
  );
}

export function useWalletSdkT(): WalletSdkTranslator {
  const ctx = useContext(WalletSdkI18nContext);
  if (!ctx) {
    return createWalletSdkTranslator();
  }
  return ctx;
}

export function useWalletSdkMessagesArray(key: string): string[] {
  const messages = useContext(WalletSdkMessagesContext);
  return walletSdkMessagesArray(messages, key);
}

export function useWalletSdkCatalog(): WalletSdkMessages {
  return useContext(WalletSdkMessagesContext);
}
