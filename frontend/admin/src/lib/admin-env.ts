function normalizeWebsiteDomain(raw: string): string | null {
  const domain = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return domain || null;
}

/** Production API origin derived from WEBSITE_DOMAIN (hydrated at startup by loadTmcEnv). */
export function deriveProductionApiUrl(): string | null {
  const domain = normalizeWebsiteDomain(process.env.WEBSITE_DOMAIN ?? "");
  return domain ? `https://api.${domain}` : null;
}

/** Local admin default backend — not stored in profile env files. */
export function getLocalDevBackendUrl(): string {
  const configured = process.env.BACKEND_API_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "http://127.0.0.1:4000";
}
