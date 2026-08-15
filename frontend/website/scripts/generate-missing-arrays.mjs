#!/usr/bin/env node
/**
 * Validates translation-arrays/*.json length. Does NOT overwrite with cross-locale clones.
 * Use auto-translate-locales.py to generate missing locale arrays from English.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "_locale-data");
const outDir = join(dataDir, "translation-arrays");

const translatable = JSON.parse(
  readFileSync(join(dataDir, "translatable-strings.json"), "utf8"),
);
const expected = translatable.length;

let failed = false;

for (const file of readdirSync(outDir)) {
  if (!file.endsWith(".json")) continue;
  const code = file.replace(".json", "");
  const arr = JSON.parse(readFileSync(join(outDir, file), "utf8"));
  if (arr.length !== expected) {
    console.error(`${code}: expected ${expected}, got ${arr.length}`);
    failed = true;
  } else {
    console.log(`${code}: ok (${arr.length})`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("All translation arrays valid.");
