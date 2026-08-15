#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale } from "./_locale-data/en.mjs";
import { LOCALE_OVERRIDES } from "./_locale-data/overrides.mjs";
import { deepMerge } from "./_locale-data/deep-merge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const en = buildEnLocale();

const LOCALE_CONTENT = { en };
for (const [code, override] of Object.entries(LOCALE_OVERRIDES)) {
  LOCALE_CONTENT[code] = deepMerge(en, override);
}

const out = `export const LOCALE_CONTENT = ${JSON.stringify(LOCALE_CONTENT, null, 2)};\n`;
writeFileSync(join(__dirname, "locale-content.mjs"), out, "utf8");

const lines = out.split("\n").length;
console.log(`Wrote locale-content.mjs (${lines} lines, ${Object.keys(LOCALE_CONTENT).length} locales)`);
