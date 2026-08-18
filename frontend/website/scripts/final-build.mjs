#!/usr/bin/env node
/**
 * One-shot builder for locale-content.mjs
 * Run: node final-build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale, EN_WALLET } from "./_locale-data/en.mjs";
import { WALLET_ES } from "./_locale-data/wallet-es.mjs";
import { makeWallet } from "./_locale-data/wallet-factory.mjs";
import { translateSite, buildDict } from "./_locale-data/site-translate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const enStrings = JSON.parse(
  readFileSync(join(__dirname, "_locale-data/en-strings.json"), "utf8"),
);
const translatable = JSON.parse(
  readFileSync(
    join(__dirname, "_locale-data/translatable-strings.json"),
    "utf8",
  ),
);

// Load per-locale translation arrays (243 items each, aligned to translatable list)
const { TRANSLATION_ARRAYS } =
  await import("./_locale-data/translation-arrays.mjs");

function buildPartial(code) {
  const arr = TRANSLATION_ARRAYS[code];
  if (!arr || arr.length !== translatable.length) {
    throw new Error(
      `Invalid translation array for ${code}: expected ${translatable.length}, got ${arr?.length ?? 0}`,
    );
  }
  const map = Object.fromEntries(translatable.map((s, i) => [s, arr[i]]));
  return Object.fromEntries(enStrings.map((s) => [s, map[s] ?? s]));
}

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
  const partial = buildPartial(code);
  const arr = enStrings.map((s) => partial[s]);
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
