#!/usr/bin/env node
/**
 * Export live gitignored env files into env/vault/ for setup on another machine.
 *
 * Usage:
 *   npm run setup:export
 *   npm run setup:export:all
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { collectPlannedTargets, repoRoot, vaultPathFor } from "./env-targets.mjs";

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
  } else if (!opts.dryRun) {
    console.log(
      "\nCopy env/vault/ to your new machine, then run: npm run setup:all",
    );
  }
}

main();
