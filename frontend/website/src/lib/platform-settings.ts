import type { PublicPlatformConfigResponse } from "@trustmycard/shared/platform-config/types";

function backendBase(): string {
  const raw = process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000";
  return raw.replace(/\/\/localhost\b/i, "//127.0.0.1");
}

export async function fetchPublicPlatformConfig(): Promise<PublicPlatformConfigResponse> {
  const res = await fetch(`${backendBase()}/v1/api/settings/public`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load platform config (${res.status})`);
  }
  return res.json() as Promise<PublicPlatformConfigResponse>;
}

/** @deprecated Use fetchPublicPlatformConfig().config */
export type PublicPlatformSettings = PublicPlatformConfigResponse;

export const fetchPublicPlatformSettings = fetchPublicPlatformConfig;
