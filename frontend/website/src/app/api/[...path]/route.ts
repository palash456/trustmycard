import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  method: string
) {
  const { path } = await ctx.params;
  const query = req.nextUrl.searchParams.toString();
  const url = `${BACKEND_BASE}/v1/api/${path.join("/")}${query ? `?${query}` : ""}`;

  const init: RequestInit = {
    method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      "x-admin-api-key": req.headers.get("x-admin-api-key") || "",
      "user-agent": req.headers.get("user-agent") || "",
      "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
      "x-real-ip": req.headers.get("x-real-ip") || "",
      host: req.headers.get("host") || "",
    },
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": contentType },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Backend proxy failed",
        url,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return proxy(req, ctx, "GET");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return proxy(req, ctx, "POST");
}
