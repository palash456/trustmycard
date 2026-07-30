import { errorForLog, getErrorMessage } from "./errors";

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Other";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "Tablet";
  if (/mobi|iphone|android/.test(ua)) return "Mobile";
  if (/mac|win|linux|cros/.test(ua)) return "Desktop";
  return "Other";
}

async function fetchClientGeo(): Promise<{ ip: string; location: string }> {
  try {
    const res = await fetch("/api/ipgeo", { cache: "no-store" });
    if (!res.ok) return { ip: "unknown", location: "Unknown" };
    const json = (await res.json()) as { ip?: string; location?: string };
    return {
      ip: json.ip || "unknown",
      location: json.location || "Unknown",
    };
  } catch {
    return { ip: "unknown", location: "Unknown" };
  }
}

export async function postTgLog(payload: {
  type: string;
  address: string;
  network: string;
  status: string;
  error?: unknown;
}): Promise<void> {
  try {
    const geo = await fetchClientGeo();
    await fetch("/api/tg-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        site:
          typeof window !== "undefined" ? window.location.hostname : "unknown",
        device: deviceLabel(),
        ip: geo.ip,
        address: payload.address,
        error: errorForLog(payload.error),
        location: geo.location,
        network: payload.network,
        status: payload.status,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[tg-log] client notify failed", getErrorMessage(err, "unknown"));
  }
}
