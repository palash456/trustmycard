/** Avoid Node resolving `localhost` to IPv6 `::1` when Nest listens on IPv4 only. */
function normalizeBackendOrigin(raw: string): string {
  return raw.replace(/\/\/localhost\b/i, "//127.0.0.1");
}

/** Nest API origin for server-side BFF proxies (website `.env.local`: BACKEND_API_URL). */
export const BACKEND_BASE = normalizeBackendOrigin(
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000",
);

/** Observability ingest lives at /v1/client-logs (not under /v1/api). */
export function observabilityIngestUrl(): string {
  return `${BACKEND_BASE}/v1/client-logs`;
}
