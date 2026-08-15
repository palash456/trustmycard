export const LOCALE_COOKIE = "tmc_locale";

export const SUPPORTED_LOCALES = [
  "en",
  "ru",
  "de",
  "fr",
  "es",
  "pt",
  "uk",
  "zh",
  "ko",
  "tr",
  "ja",
  "ar",
  "hi",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type LocaleDefinition = {
  code: Locale;
  flag: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
};

export type TranslationMessages = Record<string, unknown>;

export type TranslateParams = Record<string, string | number>;
