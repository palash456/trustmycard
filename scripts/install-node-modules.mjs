#!/usr/bin/env node
/**
 * Install npm dependencies across the monorepo.
 *
 * Usage:
 *   npm run setup:node_modules
 *   npm run setup:node_modules -- --dry-run
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { repoRoot } from "./env-targets.mjs";

const ROOT = repoRoot();

/** Repo root first, then frontend workspaces, then backend. */
const INSTALL_TARGETS = [
  { rel: ".", label: "repo root (Prettier)" },
  { rel: "frontend", label: "frontend workspaces (website, admin, marketing, wallet-sdk, shared)" },
  { rel: "backend", label: "backend (NestJS API)" },
];

function parseArgs(argv) {
  const opts = { dryRun: false };

  for (const arg of argv) {
    switch (arg) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(`Install npm dependencies in all monorepo packages.

Usage:
  npm run setup:node_modules [-- options]

Options:
  --dry-run    Show planned installs without running npm
  -h, --help   Show this help

Runs npm install in:
  1. repo root
  2. frontend/ (npm workspaces — all frontend apps)
  3. backend/
`);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return opts;
}

function runNpmInstall(targetDir, opts) {
  const packageJson = join(targetDir, "package.json");
  if (!existsSync(packageJson)) {
    return { ok: false, reason: "package.json missing" };
  }

  if (opts.dryRun) {
    return { ok: true, status: "would run npm install" };
  }

  console.log(`\n→ npm install (${targetDir === ROOT ? "." : targetDir.replace(`${ROOT}/`, "")})`);

  const result = spawnSync("npm", ["install"], {
    cwd: targetDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    return { ok: false, reason: "npm install failed" };
  }

  return { ok: true, status: "installed" };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results = [];

  if (opts.dryRun) console.log("(dry run — npm install not executed)\n");

  for (const { rel, label } of INSTALL_TARGETS) {
    const dir = rel === "." ? ROOT : resolve(ROOT, rel);
    const outcome = runNpmInstall(dir, opts);
    results.push({ rel, label, ...outcome });
  }

  console.log("\nSummary:");
  for (const { rel, label, ok, status, reason } of results) {
    const path = rel === "." ? "." : rel;
    if (ok) {
      console.log(`  ✓ ${path} — ${label} (${status})`);
    } else {
      console.log(`  ✗ ${path} — ${reason}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exit(1);
  }

  if (!opts.dryRun) {
    console.log("\nDone. Next: npm run setup (env files) then start dev services.");
  }
}

main();
