import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isSupportedLocale } from "./config";
import { getMessages } from "./messages";
import { createTranslator } from "./translate";
import { LOCALE_COOKIE, type Locale } from "./types";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value && isSupportedLocale(value)) return value;
  return DEFAULT_LOCALE;
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const { t } = createTranslator(messages, getMessages(DEFAULT_LOCALE));
  return t;
}
