#!/usr/bin/env node
/**
 * Bootstrap local secret/config files from tracked *.example templates.
 * Safe by default: skips targets that already exist unless --force.
 *
 * Usage:
 *   npm run setup
 *   npm run setup -- --profile production --include-deploy
 *   npm run setup -- --profile all --include-deploy --manifest micro-local
 *   npm run setup -- --dry-run
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "out", "build"]);

/** Multiple manifest examples map to one live file — pick with --manifest. */
const MANIFEST_SOURCES = {
  micro: {
    source: "deploy/manifest.production.micro.example.json",
    target: "deploy/manifest.production.json",
  },
  "micro-local": {
    source: "deploy/manifest.production.micro.local.example.json",
    target: "deploy/manifest.production.json",
  },
  "budget-json": {
    source: "deploy/manifest.production.example.json",
    target: "deploy/manifest.production.json",
  },
  "budget-yaml": {
    source: "deploy/manifest.production.example.yaml",
    target: "deploy/manifest.production.yaml",
  },
};

const DEPLOY_ALWAYS = ["deploy/provider.credentials.example.env"];

/** Legacy templates — profile env files replaced these. */
const EXCLUDE_EXAMPLES = new Set([
  "backend/.env.example",
  "frontend/admin/.env.example",
]);

const RUNTIME_FILES = [
  {
    sourceRel: "deploy/runtime-config/production.template.json",
    targetRel: "deploy/runtime-config/production.json",
  },
  {
    sourceRel: null,
    targetRel: "deploy/runtime-config/audit.ndjson",
    empty: true,
  },
];

function parseArgs(argv) {
  const opts = {
    profile: "development",
    includeDeploy: false,
    includeRuntime: false,
    manifest: "micro",
    force: false,
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
  --force                Overwrite existing files
  --dry-run              Show actions without writing
  -h, --help             Show this help
`);
}

function rel(path) {
  return relative(ROOT, path);
}

function findExampleFiles(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findExampleFiles(full, results);
      continue;
    }
    if (entry.name.includes(".example")) {
      results.push(full);
    }
  }
  return results;
}

function exampleToTarget(examplePath) {
  const relPath = rel(examplePath);

  for (const { source, target } of Object.values(MANIFEST_SOURCES)) {
    if (relPath === source) return target;
  }

  if (relPath.includes(".example.")) {
    return relPath.replace(".example.", ".");
  }
  if (relPath.endsWith(".example")) {
    return relPath.slice(0, -".example".length);
  }
  return null;
}

function profileMatches(exampleRel, profile) {
  const match = exampleRel.match(/^env\/profiles\/([^/]+)\//);
  if (!match) return true;
  const exampleProfile = match[1];
  return profile === "all" || exampleProfile === profile;
}

function shouldIncludeExample(exampleRel, opts) {
  if (exampleRel.startsWith("deploy/")) {
    if (!opts.includeDeploy) return false;
    if (DEPLOY_ALWAYS.some((p) => exampleRel === p)) return true;
    const manifestSources = new Set(
      Object.values(MANIFEST_SOURCES).map((m) => m.source),
    );
    if (manifestSources.has(exampleRel)) {
      return MANIFEST_SOURCES[opts.manifest].source === exampleRel;
    }
    return true;
  }
  return profileMatches(exampleRel, opts.profile);
}

function copyOne({ sourceRel, targetRel, empty = false, opts, actions }) {
  const source = sourceRel ? resolve(ROOT, sourceRel) : null;
  const target = resolve(ROOT, targetRel);

  if (!empty && source && !existsSync(source)) {
    actions.skipped.push({ target: targetRel, reason: "source missing" });
    return;
  }

  if (existsSync(target) && !opts.force) {
    actions.skipped.push({ target: targetRel, reason: "already exists" });
    return;
  }

  const label = opts.dryRun ? "would create" : "created";
  if (opts.dryRun) {
    actions.created.push({ target: targetRel, label });
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  if (empty) {
    writeFileSync(target, "", { flag: opts.force ? "w" : "wx" });
  } else {
    copyFileSync(source, target);
  }
  actions.created.push({ target: targetRel, label });
}

function collectPlannedCopies(opts) {
  const copies = [];
  const seenTargets = new Set();

  for (const examplePath of findExampleFiles(ROOT)) {
    const exampleRel = rel(examplePath);
    if (EXCLUDE_EXAMPLES.has(exampleRel)) continue;
    if (!shouldIncludeExample(exampleRel, opts)) continue;

    const targetRel = exampleToTarget(exampleRel);
    if (!targetRel) continue;

    if (seenTargets.has(targetRel)) continue;
    seenTargets.add(targetRel);

    copies.push({ sourceRel: exampleRel, targetRel });
  }

  if (opts.includeRuntime) {
    for (const item of RUNTIME_FILES) {
      if (seenTargets.has(item.targetRel)) continue;
      seenTargets.add(item.targetRel);
      copies.push(item);
    }
  }

  copies.sort((a, b) => a.targetRel.localeCompare(b.targetRel));
  return copies;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actions = { created: [], skipped: [] };

  const copies = collectPlannedCopies(opts);
  for (const item of copies) {
    copyOne({ ...item, opts, actions });
  }

  console.log(`Profile: ${opts.profile}`);
  if (opts.includeDeploy) {
    console.log(`Deploy manifest: ${opts.manifest}`);
  }
  if (opts.dryRun) console.log("(dry run — no files written)\n");

  if (actions.created.length) {
    console.log("\nCreated:");
    for (const { target, label } of actions.created) {
      console.log(`  ${label ?? "created"} ${target}`);
    }
  }

  if (actions.skipped.length) {
    console.log("\nSkipped:");
    for (const { target, reason } of actions.skipped) {
      console.log(`  ${target} (${reason})`);
    }
  }

  if (!actions.created.length && !actions.skipped.length) {
    console.log("\nNo templates matched the selected options.");
  }

  console.log(
    "\nNext: fill secrets in the created files, then start dev services.",
  );
  console.log("Docs: docs/infrastructure/environments.md");
}

main();
