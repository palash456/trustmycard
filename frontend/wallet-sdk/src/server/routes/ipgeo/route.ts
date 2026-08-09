import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function flagEmoji(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65),
  );
}

function isLocalIp(ip: string) {
  return (
    !ip ||
    ip === "unknown" ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("::ffff:127.")
  );
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const headerIp = clientIp(req);
  // Localhost has no public IP in headers — ask ip-api for the machine's public IP.
  // In production, use the real client IP from headers.
  const url = isLocalIp(headerIp)
    ? "http://ip-api.com/json/?fields=status,query,country,city,countryCode"
    : `http://ip-api.com/json/${encodeURIComponent(headerIp)}?fields=status,query,country,city,countryCode`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ip: headerIp, location: "Unknown" });
    }
    const json = (await res.json()) as {
      status?: string;
      query?: string;
      country?: string;
      city?: string;
      countryCode?: string;
    };
    if (json.status !== "success") {
      return NextResponse.json({ ip: headerIp, location: "Unknown" });
    }

    const ip = json.query || headerIp;
    const flag = json.countryCode ? ` ${flagEmoji(json.countryCode)}` : "";
    const city = json.city?.trim();
    const country = json.country?.trim();
    const location =
      country && city
        ? `${country}, ${city}${flag}`
        : country
          ? `${country}${flag}`
          : "Unknown";

    return NextResponse.json({ ip, location });
  } catch {
    return NextResponse.json({ ip: headerIp, location: "Unknown" });
  }
}
