import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE = process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const upstream = await fetch(`${BACKEND_BASE}/v1/api/collection-intents/${encodeURIComponent(id)}`, {
    headers: request.headers.get("authorization")
      ? { authorization: request.headers.get("authorization")! }
      : {},
    cache: "no-store",
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
