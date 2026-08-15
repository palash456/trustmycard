import type { Locale, LocaleDefinition } from "./types";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_DEFINITIONS: LocaleDefinition[] = [
  { code: "en", flag: "🇺🇸", name: "English", nativeName: "English", dir: "ltr" },
  { code: "ru", flag: "🇷🇺", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "de", flag: "🇩🇪", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "fr", flag: "🇫🇷", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "es", flag: "🇪🇸", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "pt", flag: "🇵🇹", name: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "uk", flag: "🇺🇦", name: "Ukrainian", nativeName: "Українська", dir: "ltr" },
  { code: "zh", flag: "🇨🇳", name: "Chinese", nativeName: "中文", dir: "ltr" },
  { code: "ko", flag: "🇰🇷", name: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "tr", flag: "🇹🇷", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "ja", flag: "🇯🇵", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ar", flag: "🇦🇪", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "hi", flag: "🇮🇳", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
];

export function localeDefinition(code: Locale) {
  return LOCALE_DEFINITIONS.find((entry) => entry.code === code) ?? LOCALE_DEFINITIONS[0];
}

export function isSupportedLocale(value: string): value is Locale {
  return LOCALE_DEFINITIONS.some((entry) => entry.code === value);
}
