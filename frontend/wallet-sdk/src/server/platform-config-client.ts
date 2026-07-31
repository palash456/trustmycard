import { BACKEND_BASE } from "./backend-base";
import type { PublicPlatformConfigResponse } from "@trustmycard/shared/platform-config/types";

let cached: PublicPlatformConfigResponse | null = null;
let cachedAt = 0;
const TTL_MS = 5_000;

export async function fetchServerPlatformConfig(): Promise<PublicPlatformConfigResponse> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;
  const res = await fetch(`${BACKEND_BASE}/v1/api/settings/public`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load platform config (${res.status})`);
  }
  cached = (await res.json()) as PublicPlatformConfigResponse;
  cachedAt = now;
  return cached;
}

export async function getTronFullHost(): Promise<string> {
  const { config } = await fetchServerPlatformConfig();
  return config.chains.tronFullHost || "https://api.trongrid.io";
}
