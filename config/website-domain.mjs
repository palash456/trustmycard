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

/** Active Meta Pixel ID — platform.env first, runtime-config fallback. */
export function resolveMetaPixelId() {
  const fromPlatform = process.env.META_PIXEL_ID?.trim();
  if (fromPlatform) return fromPlatform;
  return tryReadProductionRuntimeState()?.META_PIXEL_ID?.trim() || null;
}

/** Active WEBSITE_DOMAIN — platform.env first, runtime-config fallback. */
export function resolveWebsiteDomain() {
  const fromPlatform = normalizeWebsiteDomain(process.env.WEBSITE_DOMAIN ?? "");
  if (fromPlatform) return fromPlatform;
  return normalizeWebsiteDomain(
    tryReadProductionRuntimeState()?.WEBSITE_DOMAIN ?? "",
  );
}

/** Public production API origin — https://api.<WEBSITE_DOMAIN>. */
export function resolveProductionApiOrigin() {
  const domain = resolveWebsiteDomain();
  return domain ? `https://api.${domain}` : null;
}

/**
 * Production backend URL for admin (and other operators):
 * 1. Derive from WEBSITE_DOMAIN (platform.env → runtime-config)
 * 2. BACKEND_API_URL profile / host env (final fallback)
 */
export function resolveProductionBackendUrl() {
  const derived = resolveProductionApiOrigin();
  if (derived) return derived;
  const fromProfile = process.env.BACKEND_API_URL?.trim();
  return fromProfile ? fromProfile.replace(/\/$/, "") : null;
}

/** Apply canonical WEBSITE_DOMAIN / META_PIXEL_ID to process.env after profile load. */
export function hydrateRuntimePlatformValues() {
  const domain = resolveWebsiteDomain();
  if (domain) process.env.WEBSITE_DOMAIN = domain;

  const pixel = resolveMetaPixelId();
  if (pixel) process.env.META_PIXEL_ID = pixel;
}
