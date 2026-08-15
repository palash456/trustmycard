import { localeDefinition } from "./config";
import type { Locale } from "./types";

/** Resolve a language name in the current UI locale (not the target language's native name). */
export function languageLabel(
  t: (key: string) => string,
  targetLocale: Locale,
): string {
  const key = `languages.${targetLocale}`;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }
  return localeDefinition(targetLocale).name;
}
