import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnLocale } from "../en.mjs";
import { translateSite, buildDict } from "../site-translate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function makeSiteFromMap(mapFile) {
  const enStrings = JSON.parse(
    readFileSync(join(__dirname, "../en-strings.json"), "utf8"),
  );
  const map = JSON.parse(readFileSync(join(__dirname, mapFile), "utf8"));
  const dict = buildDict(enStrings, map);
  const en = buildEnLocale();
  const site = translateSite(en, dict);
  delete site.wallet;
  return site;
}
