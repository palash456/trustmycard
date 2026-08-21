#!/usr/bin/env node
/**
 * Bootstrap local secret/config files from tracked *.example templates.
 * Applies secrets from env/vault/ (or --from another repo checkout).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";
import { mergeEnvFillEmpty, mergeEnvFromExample } from "./env-merge.mjs";
import {
  collectPlannedTargets,
  isEnvTarget,
  MANIFEST_SOURCES,
  overlayPathFor,
  repoRoot,
} from "./env-targets.mjs";

const ROOT = repoRoot();

function parseArgs(argv) {
  const opts = {
    profile: "development",
    includeDeploy: false,
    includeRuntime: false,
    manifest: "micro",
    force: false,
    dryRun: false,
    from: process.env.TMC_SETUP_SOURCE?.trim() || null,
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
      case "--from":
        opts.from = argv[++i];
        break;
      case "--force":
        opts.force = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!["development", "production", "all"].includes(opts.profile)) {
    console.error(`Invalid --profile: ${opts.profile}`);
    process.exit(1);
  }
  if (!MANIFEST_SOURCES[opts.manifest]) {
    console.error(`Invalid --manifest: ${opts.manifest}`);
    process.exit(1);
  }

  return opts;
}

function printHelp() {
  console.log(`Bootstrap local config from tracked *.example templates.

Usage:
  npm run setup [-- options]

Options:
  --profile <name>       development | production | all  (default: development)
  --include-deploy       Copy deploy/provider.credentials.env + deploy manifest
  --include-runtime      Copy runtime-config template + empty audit log
  --manifest <kind>      micro | micro-local | budget-json | budget-yaml (default: micro)
  --from <path>          Fill empty secrets from another repo checkout
                         (or set TMC_SETUP_SOURCE). Also uses env/vault/ when present.
  --force                Overwrite existing files (disables merge)
  --dry-run              Show actions without writing
  -h, --help             Show this help

Secrets workflow (new machine):
  1. On your main machine:  npm run setup:export
  2. Copy env/vault/ to the new machine (or sync the whole project folder)
  3. On the new machine:    npm run setup:all
`);
}

function applySecretsOverlay(content, targetRel, opts) {
  const overlayPath = overlayPathFor(opts, targetRel);
  if (!overlayPath || !isEnvTarget(targetRel)) {
    return { content, changed: false };
  }

  const merged = mergeEnvFillEmpty(content, readFileSync(overlayPath, "utf8"));
  if (!merged) return { content, changed: false };
  return { content: merged, changed: true };
}

function writeTarget(target, content, opts) {
  if (opts.dryRun) return;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function copyOne({ sourceRel, targetRel, empty = false, opts, actions }) {
  const source = sourceRel ? resolve(ROOT, sourceRel) : null;
  const target = resolve(ROOT, targetRel);

  if (!empty && source && !existsSync(source)) {
    actions.skipped.push({ target: targetRel, reason: "source missing" });
    return;
  }

  if (empty) {
    if (existsSync(target) && !opts.force) {
      actions.skipped.push({ target: targetRel, reason: "already exists" });
      return;
    }
    if (opts.dryRun) {
      actions.created.push({ target: targetRel, label: "would create" });
      return;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "", { flag: opts.force ? "w" : "wx" });
    actions.created.push({ target: targetRel, label: "created" });
    return;
  }

  const overlayAvailable = Boolean(overlayPathFor(opts, targetRel));
  let content;
  let kind;

  if (existsSync(target) && !opts.force) {
    const sourceContent = readFileSync(source, "utf8");
    const targetContent = readFileSync(target, "utf8");

    if (isEnvTarget(targetRel)) {
      content = mergeEnvFromExample(sourceContent, targetContent) ?? targetContent;
      kind = content !== targetContent ? "merged" : "existing";
    } else {
      actions.skipped.push({ target: targetRel, reason: "already exists" });
      return;
    }
  } else {
    content = readFileSync(source, "utf8");
    kind = existsSync(target) && opts.force ? "recreated" : "created";
  }

  let secretsApplied = false;
  if (isEnvTarget(targetRel)) {
    const overlay = applySecretsOverlay(content, targetRel, opts);
    content = overlay.content;
    secretsApplied = overlay.changed;
  }

  if (kind === "existing" && !secretsApplied) {
    actions.skipped.push({ target: targetRel, reason: "already up to date" });
    return;
  }

  if (opts.dryRun) {
    if (kind === "merged") {
      actions.merged.push({ target: targetRel, label: "would merge" });
    } else if (kind === "existing") {
      // secrets only
    } else {
      actions.created.push({
        target: targetRel,
        label: kind === "recreated" ? "would recreate" : "would create",
      });
    }
    if (secretsApplied) {
      actions.secrets.push({ target: targetRel, label: "would apply secrets" });
    }
    return;
  }

  writeTarget(target, content, opts);

  if (kind === "merged") {
    actions.merged.push({ target: targetRel, label: "merged" });
  } else if (kind !== "existing") {
    actions.created.push({
      target: targetRel,
      label: kind === "recreated" ? "recreated" : "created",
    });
  }

  if (secretsApplied) {
    actions.secrets.push({ target: targetRel, label: "applied secrets" });
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actions = { created: [], merged: [], secrets: [], skipped: [] };

  for (const item of collectPlannedTargets(opts)) {
    copyOne({ ...item, opts, actions });
  }

  console.log(`Profile: ${opts.profile}`);
  if (opts.includeDeploy) {
    console.log(`Deploy manifest: ${opts.manifest}`);
  }
  if (opts.from) {
    console.log(`Secrets source: ${opts.from}`);
  } else if (existsSync(resolve(ROOT, "env/vault"))) {
    console.log("Secrets source: env/vault/");
  }
  if (opts.dryRun) console.log("(dry run — no files written)\n");

  if (actions.created.length) {
    console.log("\nCreated:");
    for (const { target, label } of actions.created) {
      console.log(`  ${label} ${target}`);
    }
  }

  if (actions.merged.length) {
    console.log("\nMerged (added missing keys):");
    for (const { target, label } of actions.merged) {
      console.log(`  ${label} ${target}`);
    }
  }

  if (actions.secrets.length) {
    console.log("\nSecrets:");
    for (const { target, label } of actions.secrets) {
      console.log(`  ${label} ${target}`);
    }
  }

  if (actions.skipped.length) {
    console.log("\nSkipped:");
    for (const { target, reason } of actions.skipped) {
      console.log(`  ${target} (${reason})`);
    }
  }

  if (
    !actions.created.length &&
    !actions.merged.length &&
    !actions.secrets.length &&
    !actions.skipped.length
  ) {
    console.log("\nNo templates matched the selected options.");
  }

  const hasVault = existsSync(resolve(ROOT, "env/vault"));
  if (!opts.from && !hasVault && !actions.secrets.length) {
    console.log(
      "\nNo secrets source found. On your main machine run: npm run setup:export",
    );
    console.log(
      "Then copy env/vault/ here, or use: npm run setup -- --from /path/to/main/checkout",
    );
  }

  console.log("\nNext: npm run start:dev (backend) and npm run dev:admin (admin panel)");
}

main();
