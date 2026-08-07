import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";
import { clientIp, isRateLimited } from "@/lib/login-rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password ?? "").trim();
  const expected = process.env.ADMIN_PANEL_PASSWORD?.trim();

  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_PANEL_PASSWORD is not configured" },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  try {
    const token = await createSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create session",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  return NextResponse.json({ authenticated: await verifySessionToken(token) });
}
