#!/usr/bin/env node
/**
 * Export live gitignored env files into env/vault/ for setup on another machine.
 * Also writes a password-protected env/vaultDDMMHHmmss.zip (git-trackable).
 *
 * Zip password: Microsoft@2025 + HHmmss from the filename
 * (e.g. vault2008213703 → Microsoft@2025213703)
 */
import { spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import {
  collectPlannedTargets,
  repoRoot,
  VAULT_DIR,
  vaultPathFor,
  vaultZipBasename,
  vaultZipPasswordFromBasename,
  vaultZipRel,
} from "./env-targets.mjs";

const ROOT = repoRoot();

function parseArgs(argv) {
  const opts = {
    profile: "development",
    includeDeploy: false,
    includeRuntime: false,
    manifest: "micro",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--profile":
        opts.profile = argv[++i];
        break;
      case "--include-deploy":
        opts.includeDeploy = true;
        break;
      case "--include-runtime":
        opts.includeRuntime = true;
        break;
      case "--manifest":
        opts.manifest = argv[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(`Export live env files to env/vault/ for npm run setup on another machine.

Creates env/vaultDDMMHHmmss.zip (password-protected, safe to commit/push).

Password rule: Microsoft@2025 + HHmmss from zip name
  vault2008213703.zip → Microsoft@2025213703

Usage:
  npm run setup:export [-- options]

Options:
  --profile <name>       development | production | all  (default: development)
  --include-deploy       Include deploy/provider.credentials.env + manifest
  --include-runtime      Include runtime-config files
  --manifest <kind>      micro | micro-local | budget-json | budget-yaml
  --dry-run              Show actions without writing
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

function zipVault({ dryRun, at = new Date() }) {
  const vaultDir = resolve(ROOT, VAULT_DIR);
  const zipRel = vaultZipRel(at);
  const zipPath = resolve(ROOT, zipRel);
  const zipName = `${vaultZipBasename(at)}.zip`;
  const password = vaultZipPasswordFromBasename(zipName);

  if (!existsSync(vaultDir)) {
    return { ok: false, reason: "vault folder missing" };
  }

  if (dryRun) {
    return { ok: true, zipRel, zipPath, zipName, password, label: "would create" };
  }

  const result = spawnSync(
    "zip",
    ["-r", "-q", "-P", password, zipName, "vault"],
    {
      cwd: resolve(ROOT, "env"),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    return {
      ok: false,
      reason: detail || "zip command failed (install zip or use env/vault/ directly)",
    };
  }

  if (!existsSync(zipPath)) {
    return { ok: false, reason: "zip file was not created" };
  }

  return { ok: true, zipRel, zipPath, zipName, password, label: "created" };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const exported = [];
  const missing = [];

  for (const { targetRel, empty } of collectPlannedTargets(opts)) {
    if (empty) continue;

    const source = resolve(ROOT, targetRel);
    const dest = vaultPathFor(targetRel);

    if (!existsSync(source)) {
      missing.push(targetRel);
      continue;
    }

    if (opts.dryRun) {
      exported.push({ target: targetRel, label: "would export" });
      continue;
    }

    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    exported.push({ target: targetRel, label: "exported" });
  }

  console.log(`Profile: ${opts.profile}`);
  if (opts.dryRun) console.log("(dry run — no files written)\n");

  if (exported.length) {
    console.log("\nVault:");
    for (const { target, label } of exported) {
      console.log(`  ${label} ${target} → env/vault/${target}`);
    }
  }

  if (missing.length) {
    console.log("\nMissing (not exported):");
    for (const target of missing) {
      console.log(`  ${target}`);
    }
  }

  if (!exported.length) {
    console.log("\nNothing exported — create live env files first, then re-run.");
    return;
  }

  const exportedAt = new Date();
  const zip = zipVault({ dryRun: opts.dryRun, at: exportedAt });
  if (zip.ok) {
    console.log(`\nArchive: ${zip.label} ${zip.zipRel}`);
    console.log(`Password: ${zip.password}`);
  } else {
    console.log(`\nArchive: skipped (${zip.reason})`);
  }

  if (!opts.dryRun && zip.ok) {
    console.log(
      `\nTransfer ${zip.zipRel} to your new machine (safe to git push), then:`,
    );
    console.log(`  npm run setup:import -- ${zip.zipName}`);
    console.log(`  npm run setup:all`);
  }
}

main();
