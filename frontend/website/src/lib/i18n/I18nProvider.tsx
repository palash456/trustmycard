"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { WalletSdkI18nProvider } from "@trustmycard/wallet-sdk";

import { DEFAULT_LOCALE, localeDefinition } from "./config";
import { writeLocaleCookie } from "./cookie";
import { getMessages } from "./messages";
import { createTranslator } from "./translate";
import type { Locale, TranslateParams, TranslationMessages } from "./types";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  tRaw: <T = unknown>(key: string) => T | undefined;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<TranslationMessages>(() =>
    getMessages(initialLocale),
  );

  useLayoutEffect(() => {
    const def = localeDefinition(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = def.dir;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setMessages(getMessages(next));
    writeLocaleCookie(next);
    const def = localeDefinition(next);
    document.documentElement.lang = next;
    document.documentElement.dir = def.dir;
  }, []);

  const { t, tRaw } = useMemo(
    () => createTranslator(messages, getMessages(DEFAULT_LOCALE)),
    [messages],
  );
  const dir = localeDefinition(locale).dir;

  const walletSdkMessages = (messages.walletSdk as TranslationMessages) ?? {};

  return (
    <I18nContext.Provider value={{ locale, dir, setLocale, t, tRaw }}>
      <WalletSdkI18nProvider messages={walletSdkMessages}>
        {children}
      </WalletSdkI18nProvider>
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return ctx;
}
