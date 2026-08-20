import { isLiveAdminPanel } from "./local-dev-policy";

/** Matches config/website-domain.mjs. Env is hydrated by loadTmcEnv in next.config.ts. */
function normalizeWebsiteDomain(raw: string): string | null {
  const domain = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return domain || null;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Vercel/live admin: BACKEND_API_URL from host env (protocol optional). */
function resolveLiveAdminBackendUrl(): string | null {
  const configured = process.env.BACKEND_API_URL?.trim();
  if (!configured) return null;
  const trimmed = stripTrailingSlash(configured);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Local admin: WEBSITE_DOMAIN (hydrated from runtime config) → BACKEND_API_URL fallback. */
function resolveLocalProductionBackendUrl(): string | null {
  const domain = normalizeWebsiteDomain(process.env.WEBSITE_DOMAIN ?? "");
  if (domain) return `https://api.${domain}`;
  const fromProfile = process.env.BACKEND_API_URL?.trim();
  return fromProfile ? stripTrailingSlash(fromProfile) : null;
}

/** Production API URL — live admin uses BACKEND_API_URL; local uses WEBSITE_DOMAIN chain. */
export function resolveProductionBackendUrl(): string | null {
  if (isLiveAdminPanel()) return resolveLiveAdminBackendUrl();
  return resolveLocalProductionBackendUrl();
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

/** Production data source: opt-in flag plus production API URL and admin key. */
export function isProductionLogSourceEnabled(): boolean {
  if (process.env.ADMIN_ALLOW_PRODUCTION_LOGS !== "true") return false;
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  if (!apiKey) return false;
  return Boolean(resolveProductionBackendUrl());
}
