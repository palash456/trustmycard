import type { PublicPlatformConfigResponse } from "@trustmycard/shared/platform-config/types";

function backendBase(): string {
  const raw =
    process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000";
  return raw.replace(/\/\/localhost\b/i, "//127.0.0.1");
}

/** Meta Pixel ID from production API (AppSettings database). */
export async function fetchMetaPixelIdFromApi(): Promise<string | null> {
  if (process.env.TMC_ENV !== "production") return null;

  try {
    const response = await fetch(`${backendBase()}/v1/api/settings/public`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as PublicPlatformConfigResponse;
    const pixelId = payload.runtime?.metaPixelId?.trim();
    return pixelId || null;
  } catch {
    return null;
  }
}
