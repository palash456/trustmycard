import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const configDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(configDir, "..");

const VPS_RUNTIME_CONFIG_DIR = "/opt/tmc/deploy/runtime-config";

/** @param {string} raw */
export function normalizeWebsiteDomain(raw) {
  const domain = String(raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return domain || null;
}

function runtimeConfigDir(environment = "production") {
  if (process.env.TMC_RUNTIME_CONFIG_DIR) {
    return process.env.TMC_RUNTIME_CONFIG_DIR;
  }
  if (environment === "production" && existsSync(VPS_RUNTIME_CONFIG_DIR)) {
    return VPS_RUNTIME_CONFIG_DIR;
  }
  return join(repoRoot, "deploy/runtime-config");
}

function runtimeStatePath(environment = "production") {
  return join(runtimeConfigDir(environment), `${environment}.json`);
}

/** @returns {{ WEBSITE_DOMAIN?: string; META_PIXEL_ID?: string } | null} */
export function tryReadProductionRuntimeState() {
  const path = runtimeStatePath("production");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** WEBSITE_DOMAIN from env or deploy/runtime-config/production.json. */
export function resolveWebsiteDomain() {
  const fromEnv = normalizeWebsiteDomain(process.env.WEBSITE_DOMAIN ?? "");
  if (fromEnv) return fromEnv;

  const state = tryReadProductionRuntimeState();
  return normalizeWebsiteDomain(state?.WEBSITE_DOMAIN ?? "");
}

/** Public production API origin — https://api.<WEBSITE_DOMAIN>. */
export function resolveProductionApiOrigin() {
  const domain = resolveWebsiteDomain();
  return domain ? `https://api.${domain}` : null;
}

/** Fill empty WEBSITE_DOMAIN / META_PIXEL_ID from production runtime state. */
export function hydrateRuntimePlatformValues() {
  const state = tryReadProductionRuntimeState();
  if (!state) return;

  if (!process.env.WEBSITE_DOMAIN?.trim() && state.WEBSITE_DOMAIN) {
    const domain = normalizeWebsiteDomain(state.WEBSITE_DOMAIN);
    if (domain) process.env.WEBSITE_DOMAIN = domain;
  }

  if (!process.env.META_PIXEL_ID?.trim() && state.META_PIXEL_ID) {
    process.env.META_PIXEL_ID = String(state.META_PIXEL_ID).trim();
  }
}
