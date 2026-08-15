import { DEFAULT_LOCALE, isSupportedLocale } from "./config";
import { LOCALE_COOKIE, type Locale } from "./types";

/** Parse locale from a raw document.cookie string or individual cookie segment. */
export function parseLocaleFromCookieString(cookieString: string): Locale | null {
  const prefix = `${LOCALE_COOKIE}=`;
  for (const part of cookieString.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const value = trimmed.slice(prefix.length);
    if (isSupportedLocale(value)) return value;
  }
  return null;
}

export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return parseLocaleFromCookieString(document.cookie) ?? DEFAULT_LOCALE;
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}
