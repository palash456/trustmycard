#!/usr/bin/env node
/**
 * Unzip a password-protected vault archive into env/vault/.
 *
 * Usage:
 *   npm run setup:import -- vault2008213703.zip
 *   npm run setup:import                    # latest env/vault*.zip
 */
import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import {
  repoRoot,
  vaultZipPasswordFromBasename,
} from "./env-targets.mjs";

const ROOT = repoRoot();
const ENV_DIR = resolve(ROOT, "env");

function parseArgs(argv) {
  const opts = { zipName: null, dryRun: false };

  for (const arg of argv) {
    switch (arg) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(`Unzip a password-protected vault archive into env/vault/.

Password rule: Microsoft@2025 + HHmmss from zip name
  vault2008213703.zip → Microsoft@2025213703

Usage:
  npm run setup:import -- vault2008213703.zip
  npm run setup:import                    # picks newest env/vault*.zip
`);
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        opts.zipName = arg;
    }
  }

  return opts;
}

function findLatestVaultZip() {
  let entries;
  try {
    entries = readdirSync(ENV_DIR);
  } catch {
    return null;
  }

  const zips = entries
    .filter((name) => /^vault\d{10}\.zip$/i.test(name))
    .sort()
    .reverse();

  return zips[0] ?? null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const zipName = opts.zipName ?? findLatestVaultZip();

  if (!zipName) {
    console.error("No vault zip found. Pass a filename: npm run setup:import -- vaultDDMMHHmmss.zip");
    process.exit(1);
  }

  const zipPath = resolve(ENV_DIR, zipName);
  if (!existsSync(zipPath)) {
    console.error(`Missing ${zipPath}`);
    process.exit(1);
  }

  const password = vaultZipPasswordFromBasename(zipName);

  console.log(`Archive: env/${zipName}`);
  console.log(`Password: ${password}`);

  if (opts.dryRun) {
    console.log("(dry run — vault not extracted)");
    return;
  }

  const result = spawnSync(
    "unzip",
    ["-o", "-P", password, zipName],
    { cwd: ENV_DIR, encoding: "utf8" },
  );

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    console.error(detail || "unzip failed — check password and archive");
    process.exit(1);
  }

  console.log("\nVault extracted to env/vault/");
  console.log("Next: npm run setup:all");
}

main();
