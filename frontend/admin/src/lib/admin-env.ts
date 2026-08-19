/** Derive the public production API origin from WEBSITE_DOMAIN (config/platform.env). */
export function deriveProductionApiUrl(): string | null {
  const explicit = process.env.PRODUCTION_BACKEND_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const raw = process.env.WEBSITE_DOMAIN?.trim();
  if (!raw) return null;

  const domain = raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!domain) return null;

  return `https://api.${domain}`;
}

/** Local admin default backend — not stored in profile env files. */
export function getLocalDevBackendUrl(): string {
  const configured = process.env.BACKEND_API_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "http://127.0.0.1:4000";
}
