const META_PIXEL_ID_PATTERN = /\b(\d{15,16})\b/;

/** Extract Meta Pixel ID from wallet HTML (fbq init script or noscript beacon). */
export function parseMetaPixelIdFromHtml(html: string): string | null {
  const initMatch = html.match(
    /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]\s*\)/i,
  );
  if (initMatch?.[1]) return initMatch[1];

  const beaconMatch = html.match(
    /facebook\.com\/tr\?id=(\d{15,16})(?:&|["'])/i,
  );
  if (beaconMatch?.[1]) return beaconMatch[1];

  const looseMatch = html.match(
    new RegExp(`fbq\\([^)]*init[^)]*${META_PIXEL_ID_PATTERN.source}`, "i"),
  );
  return looseMatch?.[1] ?? null;
}

export type LiveWebsiteMetaPixel = {
  websiteUrl: string;
  pixelId: string | null;
  status: "found" | "not_found" | "error";
  error?: string;
  checkedAt: string;
};

function normalizeWalletUrl(domainOrUrl: string): string | null {
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

/** Fetch the public wallet homepage and read the Meta Pixel ID embedded in HTML. */
export async function fetchLiveWebsiteMetaPixel(
  domainOrUrl: string,
): Promise<LiveWebsiteMetaPixel> {
  const websiteUrl = normalizeWalletUrl(domainOrUrl);
  const checkedAt = new Date().toISOString();

  if (!websiteUrl) {
    return {
      websiteUrl: domainOrUrl,
      pixelId: null,
      status: "error",
      error: "Invalid website URL",
      checkedAt,
    };
  }

  try {
    const response = await fetch(websiteUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TrustMyCard-Admin/1.0 (+production-config)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        websiteUrl,
        pixelId: null,
        status: "error",
        error: `Website returned HTTP ${response.status}`,
        checkedAt,
      };
    }

    const html = await response.text();
    const pixelId = parseMetaPixelIdFromHtml(html);

    return {
      websiteUrl,
      pixelId,
      status: pixelId ? "found" : "not_found",
      checkedAt,
    };
  } catch (err) {
    return {
      websiteUrl,
      pixelId: null,
      status: "error",
      error: err instanceof Error ? err.message : "Unable to reach website",
      checkedAt,
    };
  }
}
