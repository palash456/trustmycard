import "server-only";

import { getErrorMessage } from "./observability";

export type WebsiteHealthResult = {
  url: string;
  ok: boolean;
  httpStatus?: number;
  statusText?: string;
  responseTimeMs?: number;
  error?: string;
  checkedAt: string;
};

const WEBSITE_TIMEOUT_MS = 10_000;

function normalizeWebsiteUrl(domainOrUrl: string): string | null {
  const trimmed = domainOrUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Probe whether the public production wallet site is reachable. */
export async function probeWebsiteHealth(
  domainOrUrl: string,
): Promise<WebsiteHealthResult> {
  const checkedAt = new Date().toISOString();
  const url = normalizeWebsiteUrl(domainOrUrl);

  if (!url) {
    return {
      url: domainOrUrl,
      ok: false,
      error: "Production website URL is not configured.",
      checkedAt,
    };
  }

  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TrustMyCard-Admin/1.0 (+system-health)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(WEBSITE_TIMEOUT_MS),
    });
    const responseTimeMs = Date.now() - start;

    return {
      url,
      ok: response.ok,
      httpStatus: response.status,
      statusText: response.statusText,
      responseTimeMs,
      error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
      checkedAt,
    };
  } catch (err) {
    return {
      url,
      ok: false,
      responseTimeMs: Date.now() - start,
      error: getErrorMessage(err, "Unable to reach website"),
      checkedAt,
    };
  }
}
