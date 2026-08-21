#!/usr/bin/env node
/**
 * Write eligibility NEXT_PUBLIC_* vars for Next.js production builds (Docker).
 * Ensures client bundles inline the same allowlist as runtime /api/balances.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");
const { loadTmcEnv } = require(path.join(repoRoot, "config/load-env.mjs"));
const {
  eligibilityEnvFromProcess,
} = require(path.join(repoRoot, "config/eligibility-env.mjs"));

loadTmcEnv("website");
const env = eligibilityEnvFromProcess();
const outPath = path.join(
  repoRoot,
  "frontend/website/.env.production.local",
);
const body = `${Object.entries(env)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join("\n")}\n`;
fs.writeFileSync(outPath, body, "utf8");
process.stdout.write(`[wallet-build] wrote ${Object.keys(env).length} eligibility vars to ${outPath}\n`);
