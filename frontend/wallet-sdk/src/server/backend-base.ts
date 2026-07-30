/** Nest API origin for server-side BFF proxies (website `.env.local`: BACKEND_API_URL). */
export const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

/** Observability ingest lives at /v1/client-logs (not under /v1/api). */
export function observabilityIngestUrl(): string {
  return `${BACKEND_BASE}/v1/client-logs`;
}
