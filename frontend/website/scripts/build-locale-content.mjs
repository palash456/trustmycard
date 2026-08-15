#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale } from "./_locale-data/en.mjs";
import { WALLET_ES } from "./_locale-data/wallet-es.mjs";
import { makeWallet } from "./_locale-data/wallet-factory.mjs";
import { translateSite, buildDict } from "./_locale-data/site-translate.mjs";
import { PARTIAL } from "./_locale-data/partial-translations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const enStrings = JSON.parse(
  readFileSync(join(__dirname, "_locale-data/en-strings.json"), "utf8"),
);
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
  const partial = PARTIAL[code];
  if (!partial) throw new Error(`Missing PARTIAL translations for ${code}`);
  const arr = enStrings.map((s) => partial[s] ?? s);
  const dict = buildDict(enStrings, arr);
  const site = translateSite(en, dict);
  delete site.wallet;
  LOCALE_CONTENT[code] = { ...site, wallet: wallets[code] };
}

const outPath = join(__dirname, "locale-content.mjs");
const body = `export const LOCALE_CONTENT = ${JSON.stringify(LOCALE_CONTENT, null, 2)};\n`;
writeFileSync(outPath, body, "utf8");
console.log(
  `Wrote ${outPath} (${body.split("\n").length} lines, ${Object.keys(LOCALE_CONTENT).length} locales)`,
);
