import { NextRequest, NextResponse } from "next/server";
import { lookupLocation } from "../../tg-log/geo";
import {
  clientIp,
  deviceFromUa,
  formatTelegramMessage,
  okResponse,
} from "../../tg-log/format";
import type { EnrichedTgLog, TgLogBody } from "../../tg-log/types";

export const dynamic = "force-dynamic";

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

  const enriched: EnrichedTgLog = {
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

  if (!token || !chatId) {
    console.warn(
      "[tg-log] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skip send",
      enriched
    );
    return NextResponse.json(okResponse(false));
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatTelegramMessage(enriched),
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

    return NextResponse.json(okResponse(true));
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
