import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${BACKEND_BASE}/v1/auth/wallet/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
