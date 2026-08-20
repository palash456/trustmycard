import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { resolveProductionBackendUrl: resolveFromPlatform } = createRequire(
  import.meta.url,
)(join(repoRoot, "config/website-domain.mjs")) as {
  resolveProductionBackendUrl: () => string | null;
};

/** Production API URL: platform/runtime WEBSITE_DOMAIN → admin BACKEND_API_URL fallback. */
export function resolveProductionBackendUrl(): string | null {
  return resolveFromPlatform();
}

/** @deprecated Prefer resolveProductionBackendUrl */
export function deriveProductionApiUrl(): string | null {
  return resolveProductionBackendUrl();
}

/** Local admin dev backend — separate from production URL resolution. */
export function getLocalDevBackendUrl(): string {
  const configured = process.env.BACKEND_API_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "http://127.0.0.1:4000";
}
