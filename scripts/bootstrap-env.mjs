#!/usr/bin/env node
/**
 * Bootstrap local secret/config files from tracked *.example templates.
 * Safe by default: copies missing targets; merges missing keys into existing
 * .env files; skips non-env targets that already exist unless --force.
 *
 * Usage:
 *   npm run setup
 *   npm run setup -- --profile production --include-deploy
 *   npm run setup -- --profile all --include-deploy --manifest micro-local
 *   npm run setup -- --dry-run
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
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
  --force                Overwrite existing files (disables merge)
  --dry-run              Show actions without writing
  -h, --help             Show this help

When a target .env file already exists, setup merges any keys from the
template that are missing locally (existing values are never overwritten).
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

function isEnvTarget(targetRel) {
  return targetRel.endsWith(".env");
}

function envKeysInContent(content) {
  const keys = new Set();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}

/** Append template keys missing from an existing .env file. */
function mergeEnvFromExample(sourceContent, targetContent) {
  const targetKeys = envKeysInContent(targetContent);
  const missingLines = [];

  for (const line of sourceContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!targetKeys.has(key)) {
      missingLines.push(line);
    }
  }

  if (!missingLines.length) return null;

  const needsNewline = targetContent.length > 0 && !targetContent.endsWith("\n");
  const banner =
    "\n# --- added by npm run setup (missing keys from template) ---\n";
  return (
    targetContent +
    (needsNewline ? "\n" : "") +
    banner +
    missingLines.join("\n") +
    "\n"
  );
}

function copyOne({ sourceRel, targetRel, empty = false, opts, actions }) {
  const source = sourceRel ? resolve(ROOT, sourceRel) : null;
  const target = resolve(ROOT, targetRel);

  if (!empty && source && !existsSync(source)) {
    actions.skipped.push({ target: targetRel, reason: "source missing" });
    return;
  }

  if (existsSync(target) && !opts.force) {
    if (!empty && source && isEnvTarget(targetRel)) {
      const sourceContent = readFileSync(source, "utf8");
      const targetContent = readFileSync(target, "utf8");
      const merged = mergeEnvFromExample(sourceContent, targetContent);

      if (!merged) {
        actions.skipped.push({ target: targetRel, reason: "already up to date" });
        return;
      }

      const label = opts.dryRun ? "would merge" : "merged";
      if (!opts.dryRun) {
        writeFileSync(target, merged, "utf8");
      }
      actions.merged.push({ target: targetRel, label });
      return;
    }

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
  const actions = { created: [], merged: [], skipped: [] };

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

  if (actions.merged.length) {
    console.log("\nMerged (added missing keys):");
    for (const { target, label } of actions.merged) {
      console.log(`  ${label ?? "merged"} ${target}`);
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
    !actions.skipped.length
  ) {
    console.log("\nNo templates matched the selected options.");
  }

  console.log(
    "\nNext: fill secrets in the created files, then start dev services.",
  );
  console.log(
    "Secrets (private keys, DATABASE_URL, VPS_HOST, …) are not in git — copy those from your other machine or secret store.",
  );
  console.log("Docs: docs/infrastructure/environments.md");
}

main();
