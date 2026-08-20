import { join } from "node:path";
import {
  normalizeWebsiteDomain,
  parseEnvFile,
} from "../core/config-compiler.mjs";
export function validateWebsiteDomainInput(input) {
  let url;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    throw new Error(
      "Website domain must be an HTTPS origin such as https://example.com",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Website domain must be a bare HTTPS origin");
  const hostname = normalizeWebsiteDomain(url.hostname);
  if (hostname.includes("*"))
    throw new Error("Website domain must not contain wildcards");
  if (hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname))
    throw new Error("Website domain must be a public hostname");
  return { hostname, walletOrigin: `https://${hostname}` };
}
export function validateMetaPixelId(input) {
  const value = String(input ?? "").trim();
  if (!/^\d{15,16}$/.test(value))
    throw new Error(
      "META_PIXEL_ID must be a 15 or 16 digit numeric Meta Pixel ID",
    );
  return value;
}
/** Default/primary managed values from config/platform.env. */
export function readPlatformDefaults(repoRoot) {
  const values = parseEnvFile(join(repoRoot, "config/platform.env"));
  return {
    WEBSITE_DOMAIN: values.WEBSITE_DOMAIN?.trim() ?? "",
    META_PIXEL_ID: values.META_PIXEL_ID?.trim() ?? "",
  };
}

/** @deprecated Alias for readPlatformDefaults */
export function readPlatformFallbacks(repoRoot) {
  return readPlatformDefaults(repoRoot);
}

/**
 * Resolve WEBSITE_DOMAIN and META_PIXEL_ID: platform.env first, runtime state fallback.
 * @param {{ WEBSITE_DOMAIN?: string; META_PIXEL_ID?: string }} platform
 * @param {{ WEBSITE_DOMAIN?: string; META_PIXEL_ID?: string } | null} runtime
 */
export function resolveManagedPlatformValues(platform, runtime = null) {
  const runtimeDomain = runtime?.WEBSITE_DOMAIN?.trim() ?? "";
  const runtimePixel = runtime?.META_PIXEL_ID?.trim() ?? "";
  return {
    WEBSITE_DOMAIN: platform.WEBSITE_DOMAIN?.trim() || runtimeDomain,
    META_PIXEL_ID: platform.META_PIXEL_ID?.trim() || runtimePixel,
  };
}

/** @deprecated Use readPlatformDefaults */
export function readManagedPlatformDefaults(repoRoot) {
  const defaults = readPlatformDefaults(repoRoot);
  return { ...defaults, active: false };
}

/** @deprecated Platform.env may hold primary values; updates always write runtime state. */
export function assertPlatformPlaceholdersEmpty() {
  return true;
}
