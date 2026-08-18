#!/usr/bin/env node
/**
 * Generates locale-content.mjs with all 13 locales.
 * Run: node _build-locale-content-final.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale } from "./_locale-data/en.mjs";
import { WALLET_ES } from "./_locale-data/wallet-es.mjs";
import { makeWallet } from "./_locale-data/wallet-factory.mjs";
import { siteOverrides } from "./_locale-data/site-overrides.mjs";
import { deepMerge } from "./_locale-data/deep-merge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const en = buildEnLocale();

const wallets = {
  es: WALLET_ES,
  de: makeWallet("de"),
  fr: makeWallet("fr"),
  ko: makeWallet("ko"),
  ja: makeWallet("ja"),
  pt: makeWallet("pt"),
  ar: makeWallet("ar"),
  hi: makeWallet("hi"),
  tr: makeWallet("tr"),
  ru: makeWallet("ru"),
  uk: makeWallet("uk"),
  zh: makeWallet("zh"),
};

const LOCALE_CONTENT = { en };
for (const code of Object.keys(wallets)) {
  LOCALE_CONTENT[code] = deepMerge(deepMerge(en, siteOverrides[code]), {
    wallet: wallets[code],
  });
}

const outPath = join(__dirname, "locale-content.mjs");
const body = `export const LOCALE_CONTENT = ${JSON.stringify(LOCALE_CONTENT, null, 2)};\n`;
writeFileSync(outPath, body, "utf8");
console.log(
  `Wrote ${outPath} — ${body.split("\n").length} lines, ${Object.keys(LOCALE_CONTENT).length} locales`,
);
