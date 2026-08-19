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
export function assertPlatformPlaceholdersEmpty(repoRoot) {
  const values = parseEnvFile(join(repoRoot, "config/platform.env"));
  const nonEmpty = ["WEBSITE_DOMAIN", "META_PIXEL_ID"].filter((key) =>
    values[key]?.trim(),
  );
  if (nonEmpty.length)
    throw new Error(
      `config/platform.env managed placeholders must be empty: ${nonEmpty.join(", ")}`,
    );
  return true;
}

export function readManagedPlatformDefaults(repoRoot) {
  const values = parseEnvFile(join(repoRoot, "config/platform.env"));
  const websiteDomain = values.WEBSITE_DOMAIN?.trim() ?? "";
  const metaPixelId = values.META_PIXEL_ID?.trim() ?? "";
  return {
    WEBSITE_DOMAIN: websiteDomain,
    META_PIXEL_ID: metaPixelId,
    active: Boolean(websiteDomain || metaPixelId),
  };
}
