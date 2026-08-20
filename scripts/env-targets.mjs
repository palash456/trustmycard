import { existsSync, readdirSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "out", "build"]);

export const MANIFEST_SOURCES = {
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

export const DEPLOY_ALWAYS = ["deploy/provider.credentials.example.env"];

export const EXCLUDE_EXAMPLES = new Set([
  "backend/.env.example",
  "frontend/admin/.env.example",
]);

export const RUNTIME_FILES = [
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

export const VAULT_DIR = "env/vault";

export function repoRoot() {
  return ROOT;
}

export function rel(path) {
  return relative(ROOT, path);
}

export function vaultPathFor(targetRel) {
  return join(ROOT, VAULT_DIR, targetRel);
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
  return profile === "all" || match[1] === profile;
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

export function collectPlannedTargets(opts) {
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

export function overlayPathFor(opts, targetRel) {
  if (opts.from) {
    const fromPath = resolve(opts.from, targetRel);
    if (existsSync(fromPath)) return fromPath;
  }
  const vault = vaultPathFor(targetRel);
  if (existsSync(vault)) return vault;
  return null;
}

export function isEnvTarget(targetRel) {
  return targetRel.endsWith(".env");
}
