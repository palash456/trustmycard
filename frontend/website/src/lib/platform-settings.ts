const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export type PublicPlatformSettings = {
  ok: boolean;
  settings: {
    "collection.defaultMode"?: string;
    "collection.networkCaps"?: Record<string, unknown>;
    "collection.approveAmountUsdtDefault"?: string;
    "permissions.allowSelfSpender"?: boolean;
  };
  timestamp: string;
};

export async function fetchPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const res = await fetch(`${BACKEND_BASE}/v1/api/settings/public`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load platform settings (${res.status})`);
  }
  return res.json() as Promise<PublicPlatformSettings>;
}
