#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EN_WALLET } from "./en.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(
  join(__dirname, "en-wallet-export.json"),
  JSON.stringify(EN_WALLET, null, 2),
  "utf8",
);
console.log("wrote en-wallet-export.json");
