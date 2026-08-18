#!/usr/bin/env node
/**
 * Generates locale-content.mjs and locales/*.json with full site + wallet translations.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale, EN_WALLET } from "./_locale-data/en.mjs";
import { WALLET_AR } from "./_locale-data/wallet-ar.mjs";
import { WALLET_ES } from "./_locale-data/wallet-es.mjs";
import { WALLET_HI } from "./_locale-data/wallet-hi.mjs";
import { WALLET_JA } from "./_locale-data/wallet-ja.mjs";
import { WALLET_PT } from "./_locale-data/wallet-pt.mjs";
import { WALLET_RU } from "./_locale-data/wallet-ru.mjs";
import { WALLET_TR } from "./_locale-data/wallet-tr.mjs";
import { WALLET_UK } from "./_locale-data/wallet-uk.mjs";
import { WALLET_ZH } from "./_locale-data/wallet-zh.mjs";
import { makeWallet } from "./_locale-data/wallet-factory.mjs";
import { walletI18nFor } from "./_locale-data/wallet-eligibility-i18n.mjs";
import { translateSite } from "./_locale-data/site-translate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const translatable = JSON.parse(
  readFileSync(join(__dirname, "_locale-data/translatable-strings.json"), "utf8"),
);

const arraysDir = join(__dirname, "_locale-data/translation-arrays");
const TRANSLATION_ARRAYS = {};
for (const file of readdirSync(arraysDir)) {
  if (!file.endsWith(".json")) continue;
  const code = file.replace(".json", "");
  TRANSLATION_ARRAYS[code] = JSON.parse(
    readFileSync(join(arraysDir, file), "utf8"),
  );
}

function buildPartial(code) {
  const arr = TRANSLATION_ARRAYS[code];
  if (!arr || arr.length !== translatable.length) {
    return null;
  }
  const map = Object.fromEntries(translatable.map((s, i) => [s, arr[i]]));
  return map;
}

const WALLET_BY_LOCALE = {
  es: WALLET_ES,
  hi: WALLET_HI,
  ar: WALLET_AR,
  ru: WALLET_RU,
  uk: WALLET_UK,
  tr: WALLET_TR,
  ja: WALLET_JA,
  zh: WALLET_ZH,
  pt: WALLET_PT,
};

function walletFor(code) {
  if (code === "en") return EN_WALLET;
  const base = WALLET_BY_LOCALE[code] ?? makeWallet(code);
  return { ...EN_WALLET, ...base, ...walletI18nFor(code) };
}

const LOCALE_CODES = [
  "en",
  "es",
  "de",
  "fr",
  "ko",
  "ja",
  "pt",
  "ar",
  "hi",
  "tr",
  "ru",
  "uk",
  "zh",
];

const en = buildEnLocale();
const LOCALE_CONTENT = { en };

for (const code of LOCALE_CODES) {
  if (code === "en") continue;

  let site = en;
  const partial = buildPartial(code);
  if (partial) {
    site = translateSite(en, partial);
  }

  LOCALE_CONTENT[code] = { ...site, wallet: walletFor(code) };
}

writeFileSync(
  join(__dirname, "locale-content.mjs"),
  `export const LOCALE_CONTENT = ${JSON.stringify(LOCALE_CONTENT, null, 2)};\n`,
  "utf8",
);

console.log(
  "locale-content.mjs written with",
  Object.keys(LOCALE_CONTENT).length,
  "locales",
);
