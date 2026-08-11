import { NextRequest, NextResponse } from "next/server";

const DEFAULT_PASSWORD = "Microsoft@2025";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password ?? "").trim();
  const expected =
    process.env.ADMIN_DEVELOPER_MODE_PASSWORD?.trim() ?? DEFAULT_PASSWORD;

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
