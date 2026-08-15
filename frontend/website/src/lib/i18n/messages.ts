import type { Locale, TranslationMessages } from "./types";
import { DEFAULT_LOCALE } from "./config";

import en from "../../../locales/en.json";
import es from "../../../locales/es.json";
import de from "../../../locales/de.json";
import fr from "../../../locales/fr.json";
import ko from "../../../locales/ko.json";
import ja from "../../../locales/ja.json";
import pt from "../../../locales/pt.json";
import ar from "../../../locales/ar.json";
import hi from "../../../locales/hi.json";
import tr from "../../../locales/tr.json";
import ru from "../../../locales/ru.json";
import uk from "../../../locales/uk.json";
import zh from "../../../locales/zh.json";

const MESSAGE_CATALOG: Record<Locale, TranslationMessages> = {
  en,
  es,
  de,
  fr,
  ko,
  ja,
  pt,
  ar,
  hi,
  tr,
  ru,
  uk,
  zh,
};

export function getMessages(locale: Locale): TranslationMessages {
  return MESSAGE_CATALOG[locale] ?? MESSAGE_CATALOG[DEFAULT_LOCALE];
}
